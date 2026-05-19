/**
 * 构建全部扩展产物（embedding worker + graph bundle）
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(script)} exited with ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function main() {
  await run(path.join(__dirname, 'build-embedding.mjs'));
  await run(path.join(__dirname, 'build-graph.mjs'));
  console.log('[build:all] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
