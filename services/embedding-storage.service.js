/**
 * MindTrace — Embedding 向量 IndexedDB 存储
 * 大数组不写入 chrome.storage.local
 */

const MindTraceEmbeddingStorage = (function () {
  'use strict';

  const DB_NAME = 'mindtrace_embeddings';
  const DB_VERSION = 1;
  const STORE_NAME = 'vectors';

  /** @type {IDBDatabase|null} */
  let dbPromise = null;

  /**
   * @returns {Promise<IDBDatabase>}
   */
  function openDb() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error || new Error('IndexedDB open failed'));
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });

    return dbPromise;
  }

  /**
   * @param {number[]|Float32Array} vector
   * @returns {number[]}
   */
  function toNumberArray(vector) {
    if (!vector) {
      return [];
    }
    if (Array.isArray(vector)) {
      return vector;
    }
    return Array.from(vector);
  }

  /**
   * @param {string} id
   * @returns {Promise<number[]|null>}
   */
  async function getEmbedding(id) {
    if (!id) {
      return null;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const row = req.result;
        if (!row || !Array.isArray(row.vector) || !row.vector.length) {
          resolve(null);
          return;
        }
        resolve(row.vector);
      };
    });
  }

  /**
   * @param {string[]} ids
   * @returns {Promise<Record<string, number[]>>}
   */
  async function getEmbeddingsBatch(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    const map = {};

    await Promise.all(
      unique.map(async (id) => {
        const vector = await getEmbedding(id);
        if (vector && vector.length) {
          map[id] = vector;
        }
      })
    );

    return map;
  }

  /**
   * @param {string} id
   * @param {number[]|Float32Array} vector
   * @returns {Promise<void>}
   */
  async function setEmbedding(id, vector) {
    if (!id) {
      return;
    }

    const normalized = toNumberArray(vector);
    if (!normalized.length) {
      return;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: id,
        vector: normalized,
        updatedAt: Date.now(),
      });

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteEmbedding(id) {
    if (!id) {
      return;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  /**
   * 旧数据迁移占位：当前版本无需额外步骤
   * @returns {Promise<void>}
   */
  async function migrateIfNeeded() {
    await openDb();
  }

  return {
    getEmbedding,
    getEmbeddingsBatch,
    setEmbedding,
    deleteEmbedding,
    migrateIfNeeded,
  };
})();
