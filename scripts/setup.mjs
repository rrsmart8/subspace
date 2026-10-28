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
console.log('\nSetup complete. Run: npm run dev:all');
