/**
 * MindTrace — 思维证据（图片）本地 IndexedDB 存储
 * 与 chrome.storage 元数据分离，仅存 Blob，不上传
 */

const MindTraceImageStorage = (function () {
  'use strict';

  const DB_NAME = 'mindtrace_media';
  const DB_VERSION = 1;
  const STORE_NAME = 'images';

  /** @type {Promise<IDBDatabase>|null} */
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
        reject(request.error || new Error('IndexedDB open failed (media)'));
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('thoughtId', 'thoughtId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });

    return dbPromise;
  }

  /**
   * @param {string} thoughtId
   * @param {Blob} blob
   * @param {string} [mimeType]
   * @returns {Promise<string>} imageId
   */
  async function saveImage(thoughtId, blob, mimeType) {
    if (!thoughtId || !blob) {
      throw new Error('saveImage: missing thoughtId or blob');
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const type = mimeType || blob.type || 'image/png';

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id,
        thoughtId,
        mimeType: type,
        blob,
        createdAt: Date.now(),
      });

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(id);
    });
  }

  /**
   * @param {string} imageId
   * @returns {Promise<{ id: string, thoughtId: string, mimeType: string, blob: Blob }|null>}
   */
  async function getImageRecord(imageId) {
    if (!imageId) {
      return null;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(imageId);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const row = req.result;
        if (!row || !row.blob) {
          resolve(null);
          return;
        }
        resolve(row);
      };
    });
  }

  /**
   * @param {string} imageId
   * @returns {Promise<string|null>} object URL
   */
  async function getObjectUrl(imageId) {
    const row = await getImageRecord(imageId);
    if (!row || !row.blob) {
      return null;
    }
    return URL.createObjectURL(row.blob);
  }

  /**
   * @param {string[]} imageIds
   * @returns {Promise<Record<string, string>>}
   */
  async function getObjectUrlsBatch(imageIds) {
    const unique = [...new Set((imageIds || []).filter(Boolean))];
    const map = {};

    await Promise.all(
      unique.map(async (id) => {
        const url = await getObjectUrl(id);
        if (url) {
          map[id] = url;
        }
      })
    );

    return map;
  }

  /**
   * @param {string} imageId
   * @returns {Promise<void>}
   */
  async function deleteImage(imageId) {
    if (!imageId) {
      return;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(imageId);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  /**
   * @param {string} thoughtId
   * @returns {Promise<void>}
   */
  async function deleteImagesForThought(thoughtId) {
    if (!thoughtId) {
      return;
    }

    const db = await openDb();
    const ids = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('thoughtId');
      const req = index.getAllKeys(thoughtId);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });

    if (!ids.length) {
      return;
    }

    await Promise.all(ids.map((id) => deleteImage(id)));
  }

  /**
   * @returns {Promise<void>}
   */
  async function migrateIfNeeded() {
    await openDb();
  }

  return {
    saveImage,
    getImageRecord,
    getObjectUrl,
    getObjectUrlsBatch,
    deleteImage,
    deleteImagesForThought,
    migrateIfNeeded,
  };
})();
