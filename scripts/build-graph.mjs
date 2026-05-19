/**
 * 打包思维宇宙页：React + react-force-graph → lib/graph.bundle.js
 * 用法: npm run build:graph
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const libDir = path.join(root, 'lib');
const entry = path.join(root, 'graph', 'graph.jsx');
const outfile = path.join(libDir, 'graph.bundle.js');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function buildGraph() {
  if (!fs.existsSync(entry)) {
    throw new Error(`Graph entry not found: ${entry}`);
  }

  ensureDir(libDir);

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome109'],
    jsx: 'automatic',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log(`[build:graph] -> ${path.relative(root, outfile)}`);
}

buildGraph().catch((err) => {
  console.error(err);
  process.exit(1);
});
