// Loads variables from a local .env file into process.env, if present.
//
// Imported FIRST by the backend entrypoint so that modules reading credentials
// at import time (e.g. alpaca.mjs) see the values. Uses Node's built-in
// process.loadEnvFile (Node >= 20.12 / 22.18); it is a no-op when the file is
// missing or the runtime is older, so tests and CI without a .env still work.
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = process.env.ENV_FILE || resolve(root, '.env');

try {
  if (typeof process.loadEnvFile === 'function' && existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
} catch (error) {
  console.error(`Could not load env file ${envPath}:`, error.message);
}
