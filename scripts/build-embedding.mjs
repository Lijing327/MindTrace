/**
 * 打包 embedding Worker 并复制 ONNX Runtime WASM
 * 用法: npm run build
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const libDir = path.join(root, 'lib');
const wasmDir = path.join(libDir, 'wasm');

const workerEntry = path.join(root, 'workers', 'embedding.worker.src.js');
const workerOut = path.join(libDir, 'embedding.worker.js');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyWasmFiles() {
  const candidates = [
    path.join(root, 'node_modules', 'onnxruntime-web', 'dist'),
    path.join(root, 'node_modules', '@xenova', 'transformers', 'node_modules', 'onnxruntime-web', 'dist'),
  ];

  let srcDir = null;
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      srcDir = dir;
      break;
    }
  }

  if (!srcDir) {
    console.warn('[build] onnxruntime-web dist not found; WASM copy skipped');
    return;
  }

  ensureDir(wasmDir);
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.wasm') || f.endsWith('.mjs'));

  files.forEach((file) => {
    fs.copyFileSync(path.join(srcDir, file), path.join(wasmDir, file));
  });

  console.log(`[build] copied ${files.length} wasm asset(s) to lib/wasm/`);
}

async function buildWorker() {
  ensureDir(libDir);

  await esbuild.build({
    entryPoints: [workerEntry],
    outfile: workerOut,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome109'],
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });

  console.log(`[build] worker -> ${path.relative(root, workerOut)}`);
}

async function main() {
  if (!fs.existsSync(workerEntry)) {
    throw new Error(`Worker entry not found: ${workerEntry}`);
  }

  await buildWorker();
  copyWasmFiles();
  console.log('[build] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
