// Tier 3 investment assistant: Featherless chat completions + MCP market-data tools.
//
// The browser owns the conversation history and sends it with each request, so
// everything it sends is untrusted: only plain user/assistant text is accepted,
// tool messages are rebuilt on the server for the current turn only, and the
// system prompt plus account context always come from the server.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTier, investmentBudget } from '../../src/lib/demo-logic.ts';
import { createMcpBridge } from './mcp-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const SYSTEM_PROMPT = readFileSync(resolve(here, 'system_prompt.md'), 'utf8');
export const DEFAULT_MODEL = 'moonshotai/Kimi-K2-Instruct';
export const CHAT_LIMITS = { maxMessages: 20, maxUserChars: 2000, maxAssistantChars: 6000, maxToolRounds: 5, maxCallsPerRound: 6 };

export class ChatError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Accepts [{ role: 'user' | 'assistant', content: string }], newest last, ending with a user turn.
export function validateMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Send at least one message.' };
  const recent = input.slice(-CHAT_LIMITS.maxMessages);
  const messages = [];
  for (const m of recent) {
    if (!m || typeof m !== 'object' || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
      return { ok: false, error: 'Messages must be user or assistant text.' };
    }
    const content = m.content.trim();
    const max = m.role === 'user' ? CHAT_LIMITS.maxUserChars : CHAT_LIMITS.maxAssistantChars;
    if (!content) return { ok: false, error: 'Messages cannot be empty.' };
    if (content.length > max) return { ok: false, error: `Messages are limited to ${max} characters.` };
    messages.push({ role: m.role, content });
  }
  if (messages.at(-1).role !== 'user') return { ok: false, error: 'The last message must be from you.' };
  return { ok: true, messages };
}

const ron = n => `${Number(n).toFixed(2)} RON`;

// Server-authoritative facts about the member, appended to the system prompt.
export function accountContext(state, now = new Date()) {
  const tier = getTier(state);
  const budget = investmentBudget(state);
  const holdings = Object.entries(state.holdings ?? {}).map(([symbol, h]) => `- ${symbol}: ${h.qty} shares, total cost ${ron(h.cost)}`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return [
    '## Account context (provided by the Subspace server; authoritative)',
    `- Today's date (Europe/Bucharest): ${today}`,
    `- Tier: ${tier.level} (${tier.name})`,
    `- Available cash: ${ron(state.cash)}`,
    state.profile?.monthlyIncome ? `- Declared monthly take-home income: ${ron(state.profile.monthlyIncome)}` : null,
    `- Investment allowance: ${budget.percent}% of capital ${ron(budget.capital)} = ${ron(budget.limit)}; already invested at cost ${ron(budget.used)}; remaining ${ron(budget.remaining)}`,
    `- Lessons completed: ${state.completedLessons?.length ?? 0}`,
    holdings.length ? `- Holdings (simulated):\n${holdings.join('\n')}` : '- Holdings: none',
  ].filter(Boolean).join('\n');
}

// Some open models emit reasoning in <think> blocks; never show it to the member.
export const stripReasoning = text => String(text ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

/**
 * @param {{ complete: (body: object) => Promise<any>, tools: { listTools(): Promise<object[]>, callTool(name: string, args: object): Promise<string> }, model?: string, systemPrompt?: string }} deps
 */
export function createChatService({ complete, tools, model = DEFAULT_MODEL, systemPrompt = SYSTEM_PROMPT, temperature = 0.3, maxTokens = 1500 }) {
  return {
    async reply({ state, messages, now = new Date() }) {
      const definitions = await tools.listTools().catch(error => {
        console.error('Market-data MCP server unavailable:', error.message);
        return [];
      });
      const names = new Set(definitions.map(t => t.function.name));
      const conversation = [
        { role: 'system', content: `${systemPrompt}\n\n${accountContext(state, now)}${definitions.length ? '' : '\n\nMarket-data tools are unavailable right now. Say so if the member asks for prices or company data.'}` },
        ...messages,
      ];
      const toolsUsed = [];
      for (let round = 0; ; round++) {
        const finalRound = round >= CHAT_LIMITS.maxToolRounds;
        const body = { model, messages: conversation, temperature, max_tokens: maxTokens };
        if (definitions.length) Object.assign(body, { tools: definitions }, finalRound ? { tool_choice: 'none' } : {});
        let response;
        try { response = await complete(body); }
        catch (error) {
          console.error('Featherless request failed:', error.message);
          throw new ChatError(502, 'The assistant is unavailable right now. Please try again in a moment.');
        }
        const message = response?.choices?.[0]?.message;
        if (!message) throw new ChatError(502, 'The assistant returned an empty response.');
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls.slice(0, CHAT_LIMITS.maxCallsPerRound) : [];
        if (!calls.length || finalRound) {
          const reply = stripReasoning(message.content);
          return { reply: reply || 'Sorry, I could not produce an answer. Please rephrase your question.', toolsUsed };
        }
        conversation.push({ role: 'assistant', content: message.content ?? '', tool_calls: calls });
        for (const call of calls) {
          const name = call?.function?.name;
          const args = parseArgs(call?.function?.arguments);
          let content;
          if (!names.has(name)) content = JSON.stringify({ error: `Unknown tool: ${String(name).slice(0, 60)}` });
          else if (!args) content = JSON.stringify({ error: 'Tool arguments were not valid JSON.' });
          else { content = await tools.callTool(name, args); toolsUsed.push(name); }
          conversation.push({ role: 'tool', tool_call_id: call.id, name, content });
        }
      }
    },
  };
}

// Production wiring: Featherless SDK + the stdio MCP bridge. Returns null when
// no API key is configured, so the endpoint can report that clearly.
export async function createFeatherlessChat(env = process.env) {
  const apiKey = env.FEATHERLESS_API_KEY || env.FEATHERLESS_AI_API_KEY;
  if (!apiKey) return null;
  const { Featherless } = await import('featherless');
  const client = new Featherless({ api_key: apiKey, app: { name: 'Subspace', url: 'http://127.0.0.1:5173' } });
  const timeoutMs = Number(env.FEATHERLESS_TIMEOUT_MS) > 0 ? Number(env.FEATHERLESS_TIMEOUT_MS) : 90_000;
  const bridge = createMcpBridge();
  const complete = body => {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs); });
    // Tool rounds must not stream: the SDK's stream chunks carry no tool_calls.
    return Promise.race([client.chat.completions({ ...body, stream: false }), timeout]).finally(() => clearTimeout(timer));
  };
  const service = createChatService({ complete, tools: bridge, model: env.FEATHERLESS_MODEL || DEFAULT_MODEL });
  return { ...service, close: () => bridge.close() };
}
