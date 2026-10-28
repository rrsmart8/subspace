import './env.mjs';
import { accountNow, advanceCalendarMonth, stampAccount } from './demo-clock.mjs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDatabase, readAccount } from './database.mjs';
import * as logic from '../src/lib/demo-logic.ts';
import { DEMO_CONFIG } from '../src/config/demo.ts';
import { getQuotes, getQuote, searchAssets, browseByRange } from './alpaca.mjs';
import { ChatError, createFeatherlessChat, validateMessages } from './chatbot/chat.mjs';

import { startPerformance, financialFingerprint, valuePortfolio } from '../src/lib/performance.ts';
import { refreshPerformance, saveSnapshot } from './performance.mjs';

const CHAT_PER_MINUTE = 12;
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
async function body(req, limit = 16384) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > limit) throw new Error('Request too large'); }
  return data ? JSON.parse(data) : {};
}
// `chat` may be injected (tests); undefined means "build from env on first use", null means disabled.
export function createApi(db = openDatabase(), { demoMode = process.env.DEMO_MODE === "true", marketData = { getQuotes, getQuote }, chat } = {}) {
  const read = id => readAccount(db, id, { demoMode });
  let chatService = chat === undefined ? null : Promise.resolve(chat);
  const getChat = () => (chatService ??= createFeatherlessChat().catch(error => { console.error('Chat setup failed:', error.message); chatService = null; return null; }));
  const chatInFlight = new Set();
  const chatHistory = new Map(); // accountId -> recent request timestamps
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'POST' && path === '/api/accounts') {
        const input = await body(req);
        if (!input || typeof input !== 'object' || typeof input.requestId !== 'string' || !/^[\w-]{1,100}$/.test(input.requestId)) return json(res, 400, { error: 'A valid requestId is required' });
        const payload = JSON.stringify(input);
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        const income = logic.parseAmount(String(input.monthlyIncome ?? ''));
        if (name.length < 2 || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof income !== 'number') return json(res, 400, { error: 'Enter your name, a valid email and positive monthly take-home income in RON.' });
        db.exec('BEGIN IMMEDIATE');
        try {
          const old = db.prepare('SELECT payload, response FROM account_creations WHERE request_id = ?').get(input.requestId);
          if (old) { db.exec('COMMIT'); return old.payload === payload ? json(res, 200, JSON.parse(old.response)) : json(res, 409, { error: 'Request ID already used' }); }
          if (db.prepare("SELECT id FROM accounts WHERE lower(json_extract(state_json, '$.profile.email')) = ?").get(email)) { db.exec('ROLLBACK'); return json(res, 409, { error: 'An account with this email already exists.' }); }
          const id = randomUUID();
          const now = new Date().toISOString();
          const state = stampAccount({ accountId: id, tierLevel: 1, savingsStartedAt: now, profile: { name, email, monthlyIncome: income, accountNumber: `RON-${id.slice(0, 8).toUpperCase()}`, memberSince: now.slice(0, 10) }, cash: 0, holdings: {}, transactions: [], redeemed: {}, completedLessons: [] }, demoMode);
          db.prepare('INSERT INTO accounts (id, currency, tier, cash_bani, state_json) VALUES (?, ?, 1, 0, ?)').run(id, 'RON', JSON.stringify(state));
          db.prepare('INSERT INTO account_creations VALUES (?, ?, ?)').run(input.requestId, payload, JSON.stringify(state));
          db.exec('COMMIT');
          return json(res, 201, state);
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      if (req.method === 'GET' && path === '/api/accounts') {
        return json(res, 200, db.prepare('SELECT id, tier, cash_bani / 100.0 AS balance FROM accounts ORDER BY tier').all().map(row => { const state = read(row.id); return { ...row, tier: state.tierLevel, name: state.profile.name }; }));
      }
      if (req.method === 'GET' && path === '/api/lessons') return json(res, 200, db.prepare('SELECT content_json FROM lessons').all().map(row => JSON.parse(row.content_json)));
      if (req.method === 'GET' && path === '/api/market/quotes') {
        const symbolsParam = new URL(req.url, 'http://localhost').searchParams.get('symbols');
        const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : undefined;
        return json(res, 200, await getQuotes(symbols));
      }
      if (req.method === 'GET' && path === '/api/market/search') {
        const q = new URL(req.url, 'http://localhost').searchParams.get('q') ?? '';
        return json(res, 200, await searchAssets(q));
      }
      if (req.method === 'GET' && path === '/api/market/browse') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const minRaw = params.get('min');
        const maxRaw = params.get('max');
        const min = minRaw !== null && Number.isFinite(Number(minRaw)) ? Number(minRaw) : 0;
        const max = maxRaw !== null && Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : Infinity;
        return json(res, 200, await browseByRange(min, max));
      }
      const match = /^\/api\/accounts\/([^/]+)\/(state|actions|performance|chat)$/.exec(path);
      if (!match) return json(res, 404, { error: 'Not found' });
      const id = match[1];
      if (!read(id)) return json(res, 404, { error: 'Account not found' });
      if (req.method === 'GET' && match[2] === 'performance') {
        if (read(id).tierLevel < 2) return json(res, 403, { error: 'Performance tracking is available from Tier 2.' });
        return json(res, 200, await refreshPerformance(db, id, read, marketData, demoMode));
      }
      if (req.method === 'GET' && match[2] === 'state') return json(res, 200, read(id));
      if (req.method === 'POST' && match[2] === 'chat') {
        // Tier comes from SQLite only; nothing in the request can unlock the assistant.
        const account = read(id);
        if (account.tierLevel !== 3) return json(res, 403, { error: 'The investment assistant is available to Tier 3 members only.' });
        const input = await body(req, 65536);
        const checked = validateMessages(input?.messages);
        if (!checked.ok) return json(res, 400, { error: checked.error });
        const recent = (chatHistory.get(id) ?? []).filter(t => Date.now() - t < 60_000);
        if (chatInFlight.has(id) || recent.length >= CHAT_PER_MINUTE) return json(res, 429, { error: 'Please wait a moment before sending another message.' });
        const service = await getChat();
        if (!service) return json(res, 503, { error: 'The investment assistant is not configured on this server.' });
        chatHistory.set(id, [...recent, Date.now()]);
        chatInFlight.add(id);
        try {
          return json(res, 200, await service.reply({ state: account, messages: checked.messages }));
        } catch (error) {
          if (error instanceof ChatError) return json(res, error.status, { error: error.message });
          throw error;
        } finally { chatInFlight.delete(id); }
      }
      if (req.method !== 'POST' || match[2] !== 'actions') return json(res, 405, { error: 'Method not allowed' });
      const input = await body(req);
      if (!input || typeof input !== "object" || Array.isArray(input)) return json(res, 400, { error: "Expected a JSON object" });
      if (typeof input.requestId !== 'string' || !/^[\w-]{1,100}$/.test(input.requestId)) return json(res, 400, { error: 'A valid requestId is required' });
      const payload = JSON.stringify(input);
      const preparedState = read(id);
      let orderQuote = null, openingQuotes = null;
      // Never hold a SQLite transaction open while awaiting market-data I/O.
      if (input.action === 'trade') {
        if (preparedState.tierLevel < 2) return json(res, 403, { error: 'You need a higher tier to invest. Investments unlock at tier 2.' });
        const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
        if (symbol && ['buy', 'sell'].includes(input.side)) orderQuote = await marketData.getQuote(symbol);
      }
      if (input.action === 'performance-start') {
        if (preparedState.tierLevel !== 2) return json(res, 403, { error: 'Performance tracking starts at Tier 2.' });
        openingQuotes = await marketData.getQuotes(Object.keys(preparedState.holdings));
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const previous = db.prepare('SELECT payload, response FROM requests WHERE account_id = ? AND request_id = ?').get(id, input.requestId);
        if (previous) {
          db.exec('COMMIT');
          return previous.payload === payload ? json(res, 200, JSON.parse(previous.response)) : json(res, 409, { error: 'Request ID already used for another action' });
        }
        const state = read(id);
        const now = accountNow(state, demoMode);
        let result;
        switch (input.action) {
          case 'deposit': result = logic.deposit(state, String(input.amount ?? ''), now); break;
          case 'withdraw': result = logic.withdraw(state, String(input.amount ?? ''), now); break;
          case 'trade': {
            if (state.tierLevel < 2) { db.exec('ROLLBACK'); return json(res, 403, { error: 'You need a higher tier to invest. Investments unlock at tier 2.' }); }
            const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
            if (!['buy', 'sell'].includes(input.side)) result = { ok: false, error: 'Invalid order side' };
            else if (!symbol) result = { ok: false, error: 'A stock symbol is required.' };
            else if (!orderQuote) result = { ok: false, error: 'No price available for this order.' };
            else if (state.performance?.mode === 'market' && (!orderQuote.live || orderQuote.rate !== state.performance.fxRate)) result = { ok: false, error: 'The active tracker requires market prices at its opening RON conversion rate. Please retry when data is available.' };
            else {
              if (state.performance?.mode === 'market') {
                try { valuePortfolio({ ...state, cash: 0, holdings: { [symbol]: { qty: 1, cost: 0 } } }, [orderQuote], 'market', new Date(), state.performance.fxRate); }
                catch (error) { result = { ok: false, error: error.message }; }
              }
              if (!result) result = logic.trade(state, symbol, input.side, String(input.qty ?? ''), orderQuote.price, now);
              if (result.ok) {
                const transaction = result.state.transactions[0];
                transaction.kind = 'trade';
                transaction.execution = { symbol, side: input.side, qty: Number(input.qty), priceRON: Math.round(orderQuote.price * 100) / 100, feesRON: 0, source: orderQuote.live ? 'alpaca' : 'static', quoteAsOf: orderQuote.asOf, rate: orderQuote.rate };
              }
            }
            break;
          }
          case 'redeem': {
            const reward = DEMO_CONFIG.rewards.find(r => r.id === input.rewardId);
            result = logic.redeem(state, input.rewardId, `${reward?.prefix ?? 'DEMO'}-${randomUUID().slice(0, 8).toUpperCase()}`);
            break;
          }
          case 'lesson': {
            const row = db.prepare('SELECT content_json FROM lessons WHERE id = ?').get(input.lessonId ?? '');
            const lesson = row && JSON.parse(row.content_json);
            result = !lesson || lesson.question.correct !== input.answer ? { ok: false, error: 'Incorrect answer. Try again.' } : logic.completeLesson(state, input.lessonId);
            break;
          }
          case 'mastery-answer': result = logic.answerMastery(state, input.quarterId, input.scenarioId, input.answer, now); break;
          case 'mastery-reward': result = logic.registerMasteryReward(state, input.quarterId, now); break;
          case 'advance-month': {
            if (!demoMode) { db.exec('ROLLBACK'); return json(res, 403, { error: 'Demo timeline controls are disabled on this server.' }); }
            const advanced = advanceCalendarMonth(now);
            result = { ok: true, message: 'Demo timeline advanced by one month', state: { ...state, demoClockOffsetMs: advanced.getTime() - Date.now() } };
            break;
          }
          case 'performance-start': {
            if (financialFingerprint(state) !== financialFingerprint(preparedState)) { result = { ok: false, error: 'Account changed while opening prices loaded. Please retry.' }; break; }
            try {
              const run = startPerformance(state, openingQuotes.quotes, randomUUID(), now, new Date(), demoMode, openingQuotes.rate);
              result = { ok: true, message: 'Tier 3 assessment started. Follow your saving and investment plan.', state: { ...state, performance: run } };
              saveSnapshot(db, id, run);
            } catch (error) { result = { ok: false, error: error.message }; }
            break;
          }
          case 'reset': {
            // Reset only this fictional account, never another selected account.
            const starting = { 'demo-1': [750, 1, []], 'demo-2': [3500, 2, ['l-budget', 'l-emergency']], 'demo-3': [8500, 3, ['l-budget', 'l-emergency', 'l-compound', 'l-diversify']] }[id];
            const seed = starting ?? [0, 1, []];
            result = { ok: true, message: 'Account reset', state: { ...state, performance: undefined, demoClockOffsetMs: 0, ...(state.mastery ? { mastery: { enrolledAt: new Date().toISOString(), answers: {}, rewardClaims: {} } } : {}), savingsStartedAt: new Date().toISOString(), cash: seed[0], tierLevel: seed[1], holdings: {}, redeemed: {}, completedLessons: seed[2], transactions: [{ id: `opening-${id}`, date: new Date().toISOString(), description: 'Opening demo deposit', amount: seed[0], direction: 'in', status: 'completed' }] } };
            break;
          }
          default: result = { ok: false, error: 'Unknown action' };
        }
        if (!result.ok) { db.exec('ROLLBACK'); return json(res, 400, result); }
        if (input.action !== 'reset') result.state = logic.promoteTiers(result.state, accountNow(result.state, demoMode));
        result.state = stampAccount(result.state, demoMode);
        db.prepare('UPDATE accounts SET cash_bani = ?, tier = ?, state_json = ? WHERE id = ?').run(Math.round(result.state.cash * 100), result.state.tierLevel, JSON.stringify(result.state), id);
        db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?)').run(id, input.requestId, payload, JSON.stringify(result));
        db.exec('COMMIT');
        return json(res, 200, result);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } catch (error) {
      if (error instanceof SyntaxError || error.message === 'Request too large') return json(res, 400, { error: 'Invalid request body' });
      console.error(error);
      json(res, 500, { error: 'Unable to complete the request' });
    }
  });
  // Stop the MCP child process together with the API.
  server.on('close', () => { Promise.resolve(chatService).then(s => s?.close?.()).catch(() => {}); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApi();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Backend port ${process.env.PORT || 3001} is already in use. Stop the existing service or choose another PORT.` : error.message); process.exitCode = 1; });
  server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('SQLite API: http://127.0.0.1:' + (process.env.PORT || 3001)));
}
