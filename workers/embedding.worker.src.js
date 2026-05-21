/**
 * MindTrace — Embedding 推理 Worker（esbuild 打包为 lib/embedding.worker.js）
 */
import { env, pipeline } from '@xenova/transformers';

const MODEL_ID = 'Xenova/bge-small-zh-v1.5';

/** @type {import('@xenova/transformers').FeatureExtractionPipeline|null} */
let extractor = null;

/** @type {Promise<import('@xenova/transformers').FeatureExtractionPipeline>|null} */
let initPromise = null;

function configureEnv() {
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  // MV3 CSP 不允许 blob: worker；单线程 WASM 可避免 ONNX 创建 blob URL
  env.backends.onnx.wasm.numThreads = 1;

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/wasm/');
  }
}

/**
 * @returns {Promise<import('@xenova/transformers').FeatureExtractionPipeline>}
 */
async function loadModel() {
  if (extractor) {
    return extractor;
  }

  if (!initPromise) {
    configureEnv();
    initPromise = pipeline('feature-extraction', MODEL_ID).then((pipe) => {
      extractor = pipe;
      return pipe;
    });
  }

  return initPromise;
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const pipe = await loadModel();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const { type, requestId, text } = data;

  if (type === 'init') {
    loadModel()
      .then(() => {
        self.postMessage({ type: 'ready' });
      })
      .catch((err) => {
        self.postMessage({
          type: 'error',
          message: err && err.message ? err.message : String(err),
        });
      });
    return;
  }

  if (type === 'embed') {
    const trimmed = text && String(text).trim();
    if (!trimmed) {
      self.postMessage({ type: 'embed-result', requestId, embedding: null });
      return;
    }

    embedText(trimmed)
      .then((embedding) => {
        self.postMessage({ type: 'embed-result', requestId, embedding });
      })
      .catch((err) => {
        self.postMessage({
          type: 'error',
          requestId,
          message: err && err.message ? err.message : String(err),
        });
      });
  }
});
