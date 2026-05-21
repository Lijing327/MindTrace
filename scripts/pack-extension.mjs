/**
 * 打包 Chrome Web Store 上传用 ZIP（根目录即 manifest.json，无多余父文件夹）
 * 用法: npm run pack
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release');
const staging = path.join(outDir, '.pack-staging');
const zipPath = path.join(outDir, 'mindtrace-extension.zip');

/** 扩展根目录下的运行时文件 */
const ROOT_FILES = [
  'manifest.json',
  'background.js',
  'content.css',
  'content.js',
  'dashboard.css',
  'dashboard.html',
  'dashboard.js',
  'graph.html',
  'popup.css',
  'popup.html',
  'popup.js',
  'privacy.md',
  'storage.js',
  'utils.js',
];

/** 整目录复制（排除 .map） */
const INCLUDE_DIRS = ['icons', 'lib', 'services', 'config'];

/** 仅包含样式，不含 graph.jsx 源码 */
const GRAPH_FILES = ['graph/graph.css'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyTree(srcDir, destDir) {
  for (const name of fs.readdirSync(srcDir)) {
    if (name.endsWith('.map')) continue;
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyTree(src, dest);
    } else {
      copyFile(src, dest);
    }
  }
}

function prepareStaging() {
  rmDir(staging);
  ensureDir(staging);

  for (const file of ROOT_FILES) {
    const src = path.join(root, file);
    if (!fs.existsSync(src)) {
      throw new Error(`缺少扩展文件: ${file}`);
    }
    copyFile(src, path.join(staging, file));
  }

  for (const dir of INCLUDE_DIRS) {
    const src = path.join(root, dir);
    if (!fs.existsSync(src)) {
      throw new Error(`缺少目录: ${dir}/`);
    }
    copyTree(src, path.join(staging, dir));
  }

  for (const rel of GRAPH_FILES) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`缺少文件: ${rel}`);
    }
    copyFile(src, path.join(staging, rel));
  }

  const manifestPath = path.join(staging, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.manifest_version || !manifest.version) {
    throw new Error('manifest.json 缺少 manifest_version 或 version');
  }
}

function createZip() {
  ensureDir(outDir);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  if (process.platform === 'win32') {
    const ps = [
      '$ErrorActionPreference = "Stop"',
      `Compress-Archive -Path "${staging.replace(/\\/g, '/')}/*" -DestinationPath "${zipPath.replace(/\\/g, '/')}" -CompressionLevel Optimal`,
    ].join('; ');
    const result = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', ps],
      { stdio: 'inherit', cwd: root },
    );
    if (result.status !== 0) {
      throw new Error('Compress-Archive 失败');
    }
  } else {
    const result = spawnSync('zip', ['-r', zipPath, '.'], {
      cwd: staging,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error('zip 命令失败，请安装 zip 或使用 Windows 打包');
    }
  }
}

function verifyZip() {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`未生成 ZIP: ${zipPath}`);
  }
  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[pack] ${zipPath} (${sizeMb} MB)`);
}

function main() {
  console.log('[pack] preparing staging...');
  prepareStaging();
  console.log('[pack] creating zip...');
  createZip();
  rmDir(staging);
  verifyZip();
  console.log('[pack] done — upload release/mindtrace-extension.zip to Chrome Web Store');
}

main();
