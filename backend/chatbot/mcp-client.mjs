// Bridge between the Node backend and the local Python market-data MCP server.
//
// The server is spawned once over stdio (`uv run ... python -m market_mcp`) and
// reused for every chat request. If the process dies, the next call reconnects.
// Only the market-data variables are passed to the child: it never sees the
// Featherless key or any other backend secret.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'mcp_server');
const FORWARDED_ENV = [
  'APCA_API_KEY_ID', 'APCA_API_SECRET_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_SECRET_KEY',
  'ALPACA_DISABLE', 'ALPACA_DATA_FEED', 'ALPACA_HISTORY_FEED', 'ALPACA_USD_TO_RON',
  'ALPACA_CACHE_MS', 'ALPACA_ASSETS_TTL_MS', 'MCP_LOG_LEVEL',
];
const MAX_RESULT_CHARS = 8000;

export function defaultServerParams(env = process.env) {
  const forwarded = Object.fromEntries(FORWARDED_ENV.filter(k => env[k] !== undefined).map(k => [k, env[k]]));
  return {
    command: env.CHATBOT_UV_BIN || 'uv',
    args: ['run', '--frozen', '--directory', SERVER_DIR, 'python', '-m', 'market_mcp'],
    env: forwarded,
    stderr: 'inherit',
  };
}

// MCP tool -> OpenAI/Featherless function-tool definition.
export function toFunctionTool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  };
}

// Flattens an MCP CallToolResult into the text sent back to the model.
export function resultText(result) {
  const text = result?.structuredContent && !result.isError
    ? JSON.stringify(result.structuredContent)
    : (result?.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  const body = text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…[truncated]` : text;
  return result?.isError ? JSON.stringify({ error: body || 'The tool failed.' }) : body;
}

export function createMcpBridge({ serverParams = defaultServerParams(), timeoutMs = 30_000 } = {}) {
  let connecting = null;
  let client = null;
  let tools = null;

  async function connect() {
    if (client) return client;
    if (!connecting) {
      connecting = (async () => {
        const transport = new StdioClientTransport(serverParams);
        const next = new Client({ name: 'subspace-backend', version: '1.0.0' });
        transport.onclose = () => { if (client === next) { client = null; tools = null; } };
        await next.connect(transport);
        client = next;
        return next;
      })().finally(() => { connecting = null; });
    }
    return connecting;
  }

  return {
    // Function-tool definitions for the model, cached until the server restarts.
    async listTools() {
      const c = await connect();
      if (!tools) tools = (await c.listTools()).tools;
      return tools.map(toFunctionTool);
    },
    async callTool(name, args) {
      const c = await connect();
      if (!tools) tools = (await c.listTools()).tools;
      if (!tools.some(tool => tool.name === name)) return JSON.stringify({ error: `Unknown tool: ${name}` });
      try {
        return resultText(await c.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs }));
      } catch (error) {
        console.error(`MCP tool ${name} failed:`, error.message);
        return JSON.stringify({ error: 'The market-data tool did not respond. Try again shortly.' });
      }
    },
    async close() {
      const c = client;
      client = null; tools = null;
      await c?.close().catch(() => {});
    },
  };
}
