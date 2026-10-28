import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error('Node.js 22.18+ is required. Use Node 24 LTS (see .nvmrc).');
  process.exit(1);
}
for (const [command, args] of [['bun', ['install', '--frozen-lockfile']], [process.execPath, ['backend/seed.mjs']]]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) { console.error(`${command}: ${result.error.message}. Install Bun 1.4.3 and retry.`); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Optional: the Tier 3 assistant's market-data MCP server (Python, managed by uv).
const uv = spawnSync(process.env.CHATBOT_UV_BIN || 'uv', ['sync', '--frozen', '--directory', 'backend/chatbot/mcp_server'], { cwd: root, stdio: 'inherit', shell: false });
if (uv.error || uv.status !== 0) console.warn('\nSkipped the investment assistant setup: install uv (https://docs.astral.sh/uv/) and rerun to enable it. The rest of the app works without it.');
console.log('\nSetup complete. Run: npm run dev:all');
