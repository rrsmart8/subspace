import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const args of [['backend/server.mjs'], ['node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', process.env.FRONTEND_PORT || '5173', '--strictPort']]) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', shell: false });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
