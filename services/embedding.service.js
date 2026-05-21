/**
 * MindTrace — 本地语义向量（懒加载 + Worker + 缓存）
 */

const MindTraceEmbeddingService = (function () {
  'use strict';

  /** @type {Worker|null} */
  let worker = null;

  /** @type {boolean} */
  let workerReady = false;

  /** @type {boolean} */
  let modelLoading = false;

  /** @type {Promise<void>|null} */
  let readyPromise = null;

  /** @type {Map<string, number[]>} */
  const memoryCache = new Map();

  /** @type {Map<string, { resolve: Function, reject: Function }>} */
  const pendingRequests = new Map();

  /** @type {Array<(status: string) => void>} */
  const statusListeners = [];

  /** @type {string} */
  let status = 'idle';

  let requestCounter = 0;

  function setStatus(next) {
    status = next;
    statusListeners.forEach((fn) => {
      try {
        fn(next);
      } catch (e) {
        console.warn('[MindTrace] embedding status listener error', e);
      }
    });
  }

  /**
   * @param {(status: string) => void} listener
   * @returns {() => void}
   */
  function onStatusChange(listener) {
    statusListeners.push(listener);
    listener(status);
    return function unsubscribe() {
      const idx = statusListeners.indexOf(listener);
      if (idx !== -1) {
        statusListeners.splice(idx, 1);
      }
    };
  }

  function getStatus() {
    return status;
  }

  /**
   * 首次加载语义模型时请求可选网络权限（Hugging Face / CDN）
   * @returns {Promise<boolean>}
   */
  async function ensureModelHostPermissions() {
    if (
      typeof chrome === 'undefined' ||
      !chrome.permissions ||
      !chrome.permissions.contains
    ) {
      return true;
    }

    const origins = [
      'https://huggingface.co/*',
      'https://cdn.jsdelivr.net/*',
    ];

    const hasAll = await chrome.permissions.contains({ origins });
    if (hasAll) {
      return true;
    }

    if (!chrome.permissions.request) {
      return false;
    }

    return chrome.permissions.request({ origins });
  }

  function getWorker() {
    if (!worker) {
      const url = chrome.runtime.getURL('lib/embedding.worker.js');
      worker = new Worker(url, { type: 'module' });
      worker.addEventListener('message', onWorkerMessage);
      worker.addEventListener('error', (err) => {
        console.error('[MindTrace] embedding worker error', err);
        setStatus('error');
        rejectAllPending(new Error('Embedding worker failed'));
      });
    }
    return worker;
  }

  function rejectAllPending(error) {
    pendingRequests.forEach(({ reject }) => reject(error));
    pendingRequests.clear();
    modelLoading = false;
    if (readyPromise && readyPromise._reject) {
      readyPromise._reject(error);
    }
    readyPromise = null;
  }

  function onWorkerMessage(event) {
    const data = event.data || {};
    const { type, requestId, embedding, message } = data;

    if (type === 'ready') {
      workerReady = true;
      modelLoading = false;
      setStatus('ready');
      if (readyPromise && readyPromise._resolve) {
        readyPromise._resolve();
      }
      return;
    }

    if (type === 'error') {
      if (!requestId) {
        console.error('[MindTrace] embedding model error:', message);
        setStatus('error');
        modelLoading = false;
        if (readyPromise && readyPromise._reject) {
          readyPromise._reject(new Error(message || 'Model load failed'));
        }
        readyPromise = null;
        return;
      }

      const pending = pendingRequests.get(requestId);
      if (pending) {
        pending.reject(new Error(message || 'Embed failed'));
        pendingRequests.delete(requestId);
      }
      return;
    }

    if (type === 'embed-result') {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pending.resolve(embedding);
        pendingRequests.delete(requestId);
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  function ensureModel() {
    if (workerReady) {
      return Promise.resolve();
    }

    if (readyPromise) {
      return readyPromise;
    }

    modelLoading = true;
    setStatus('loading');

    readyPromise = new Promise((resolve, reject) => {
      readyPromise._resolve = resolve;
      readyPromise._reject = reject;
    });

    ensureModelHostPermissions()
      .then((granted) => {
        if (!granted) {
          throw new Error('需要允许访问模型 CDN 才能启用语义关联');
        }
        getWorker().postMessage({ type: 'init' });
      })
      .catch((err) => {
        modelLoading = false;
        setStatus('error');
        if (readyPromise && readyPromise._reject) {
          readyPromise._reject(err);
        }
        readyPromise = null;
      });

    return readyPromise;
  }

  /**
   * @param {string} text
   * @returns {Promise<number[]|null>}
   */
  function embedViaWorker(text) {
    const requestId = `req-${++requestCounter}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      getWorker().postMessage({ type: 'embed', requestId, text });
    });
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function getTextForEmbedding(record) {
    if (!record) {
      return '';
    }
    return [record.note, record.selectedText, record.pageTitle]
      .filter((part) => part && String(part).trim())
      .join('\n')
      .trim();
  }

  /**
   * @param {string} text
   * @param {string} [recordId]
   * @returns {Promise<number[]|null>}
   */
  async function getEmbedding(text, recordId) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return null;
    }

    if (recordId && memoryCache.has(recordId)) {
      return memoryCache.get(recordId);
    }

    if (recordId && typeof MindTraceEmbeddingStorage !== 'undefined') {
      const stored = await MindTraceEmbeddingStorage.getEmbedding(recordId);
      if (stored && stored.length) {
        memoryCache.set(recordId, stored);
        return stored;
      }
    }

    await ensureModel();
    const vector = await embedViaWorker(trimmed);

    if (!vector || !vector.length) {
      return null;
    }

    if (recordId) {
      memoryCache.set(recordId, vector);
      if (typeof MindTraceEmbeddingStorage !== 'undefined') {
        await MindTraceEmbeddingStorage.setEmbedding(recordId, vector);
      }
    }

    return vector;
  }

  /**
   * @param {InspirationRecord} record
   * @returns {Promise<number[]|null>}
   */
  async function ensureRecordEmbedding(record) {
    if (!record || !record.id) {
      return null;
    }

    if (Array.isArray(record.embedding) && record.embedding.length) {
      memoryCache.set(record.id, record.embedding);
      return record.embedding;
    }

    if (memoryCache.has(record.id)) {
      record.embedding = memoryCache.get(record.id);
      return record.embedding;
    }

    const text = getTextForEmbedding(record);
    if (!text) {
      return null;
    }

    const vector = await getEmbedding(text, record.id);
    record.embedding = vector;
    return vector;
  }

  /**
   * 保存/更新后异步写入向量，不阻塞 UI
   * @param {InspirationRecord} record
   */
  function scheduleEmbedding(record) {
    if (!record || !record.id) {
      return;
    }

    invalidateRecord(record.id);

    ensureRecordEmbedding(record).catch((err) => {
      console.warn('[MindTrace] scheduleEmbedding failed:', err);
    });
  }

  /**
   * @param {string} recordId
   */
  function invalidateRecord(recordId) {
    memoryCache.delete(recordId);
    if (typeof MindTraceEmbeddingStorage !== 'undefined') {
      MindTraceEmbeddingStorage.deleteEmbedding(recordId).catch((err) => {
        console.warn('[MindTrace] delete embedding cache failed:', err);
      });
    }
  }

  /**
   * Dashboard 打开时批量补全缺失向量
   * @param {InspirationRecord[]} records
   * @param {(record: InspirationRecord) => void} [onOneDone]
   * @returns {Promise<void>}
   */
  async function backfillMissing(records, onOneDone) {
    if (!Array.isArray(records) || !records.length) {
      return;
    }

    const queue = records.filter((r) => {
      if (!r || !r.id) {
        return false;
      }
      const text = getTextForEmbedding(r);
      if (!text) {
        return false;
      }
      return !Array.isArray(r.embedding) || !r.embedding.length;
    });

    if (!queue.length) {
      return;
    }

    await ensureModel();

    for (let i = 0; i < queue.length; i++) {
      const record = queue[i];
      try {
        await ensureRecordEmbedding(record);
        if (typeof onOneDone === 'function') {
          onOneDone(record);
        }
      } catch (err) {
        console.warn('[MindTrace] backfill embedding failed:', record.id, err);
      }
    }
  }

  return {
    getTextForEmbedding,
    getEmbedding,
    ensureRecordEmbedding,
    scheduleEmbedding,
    invalidateRecord,
    backfillMissing,
    ensureModel,
    onStatusChange,
    getStatus,
  };
})();
