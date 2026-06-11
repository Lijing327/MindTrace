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
const zipTempPath = `${zipPath}.tmp`;

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
  'universe.html',
  'universe.js',
  'universe.css',
  'storage.js',
  'utils.js',
  'privacy.md',
];

/** 整目录复制（排除 .map） */
const INCLUDE_DIRS = ['icons', 'lib', 'services', 'config', '_locales', 'src'];

/** 仅包含样式，不含 graph.jsx 源码 */
const GRAPH_FILES = ['graph/graph.css'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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

function removeFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  fs.rmSync(filePath, { force: true, maxRetries: 8, retryDelay: 200 });
}

/**
 * 使用 .NET ZipFile 生成 zip（Chrome Web Store 兼容，manifest.json 在根目录）
 * @returns {boolean}
 */
function createZipWithDotNet(destPath) {
  removeFileIfExists(destPath);
  const stagingEsc = staging.replace(/'/g, "''");
  const destEsc = destPath.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingEsc}', '${destEsc}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`,
  ].join('; ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    stdio: 'inherit',
    cwd: root,
  });
  return result.status === 0 && fs.existsSync(destPath);
}

/**
 * 使用 tar -a 生成 zip（部分 Windows tar 会把路径写成 ./manifest.json，Chrome 不接受）
 * @returns {boolean}
 */
function createZipWithTar(destPath) {
  removeFileIfExists(destPath);
  const result = spawnSync('tar', ['-a', '-c', '-f', destPath, '.'], {
    cwd: staging,
    stdio: 'inherit',
  });
  return result.status === 0 && fs.existsSync(destPath);
}

/**
 * @returns {boolean}
 */
function createZipWithZipCommand(destPath) {
  removeFileIfExists(destPath);
  const result = spawnSync('zip', ['-r', destPath, '.'], {
    cwd: staging,
    stdio: 'inherit',
  });
  return result.status === 0 && fs.existsSync(destPath);
}

/**
 * @returns {boolean}
 */
function createZipWithPowerShell(destPath) {
  removeFileIfExists(destPath);
  const stagingGlob = path.join(staging, '*').replace(/\\/g, '/');
  const dest = destPath.replace(/\\/g, '/');
  const ps = [
    '$ErrorActionPreference = "Stop"',
    `Compress-Archive -LiteralPath @(${JSON.stringify(stagingGlob)}) -DestinationPath ${JSON.stringify(dest)} -CompressionLevel Optimal -Force`,
  ].join('; ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    stdio: 'inherit',
    cwd: root,
  });
  return result.status === 0 && fs.existsSync(destPath);
}

function createZip() {
  ensureDir(outDir);
  removeFileIfExists(zipTempPath);
  removeFileIfExists(zipPath);

  const writers = [
    { name: 'ZipFile.CreateFromDirectory', run: () => createZipWithDotNet(zipTempPath) },
    { name: 'zip', run: () => createZipWithZipCommand(zipTempPath) },
    { name: 'tar', run: () => createZipWithTar(zipTempPath) },
    { name: 'Compress-Archive', run: () => createZipWithPowerShell(zipTempPath) },
  ];

  let created = false;
  for (const writer of writers) {
    console.log(`[pack] trying ${writer.name}...`);
    if (writer.run()) {
      created = true;
      console.log(`[pack] packed with ${writer.name}`);
      break;
    }
    removeFileIfExists(zipTempPath);
  }

  if (!created) {
    throw new Error('ZIP 创建失败（tar / zip / Compress-Archive 均不可用或被占用）');
  }

  removeFileIfExists(zipPath);
  fs.renameSync(zipTempPath, zipPath);
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
