/**
 * MindTrace — 本地存储模块
 * 元数据：chrome.storage.local
 * 向量：IndexedDB（MindTraceEmbeddingStorage）
 */

const MindTraceStorage = (function () {
  /** @type {string} 存储键名，集中管理便于迁移 */
  const STORAGE_KEY = 'mindtrace_inspirations';

  /**
   * 从记录对象中剥离 embedding，避免写入 chrome.storage
   * @param {InspirationRecord} record
   * @returns {InspirationRecord}
   */
  function stripEmbeddingForStorage(record) {
    if (!record) {
      return record;
    }
    const copy = { ...record };
    delete copy.embedding;
    return copy;
  }

  /**
   * 用于关键词 / 向量提取的文本
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function getTextForKeywords(record) {
    if (!record) {
      return '';
    }
    return [record.note, record.selectedText, record.pageTitle]
      .filter((part) => part && String(part).trim())
      .join('\n');
  }

  /**
   * 为单条记录补全 keywords（不写入 storage）
   * @param {InspirationRecord} record
   * @returns {InspirationRecord}
   */
  function ensureKeywords(record) {
    if (!record) {
      return record;
    }
    if (Array.isArray(record.keywords) && record.keywords.length > 0) {
      return record;
    }
    const keywords = MindTraceKeywordService.extractKeywords(
      getTextForKeywords(record)
    );
    return { ...record, keywords: keywords };
  }

  /**
   * 保存前写入 keywords
   * @param {InspirationRecord} record
   * @returns {InspirationRecord}
   */
  function withKeywords(record) {
    const keywords = MindTraceKeywordService.extractKeywords(
      getTextForKeywords(record)
    );
    return { ...record, keywords: keywords };
  }

  /**
   * 认知字段：tags + relatedIds（本地规则）
   * @param {InspirationRecord} record
   * @param {InspirationRecord[]} peerItems — 不含当前条时的其它记录
   * @returns {InspirationRecord}
   */
  function enrichCognitiveFields(record, peerItems) {
    let enriched = withKeywords(record);
    if (typeof MindTraceTagService !== 'undefined') {
      enriched = {
        ...enriched,
        tags: MindTraceTagService.assignTags(enriched),
      };
    }
    if (typeof MindTraceRelatedService !== 'undefined') {
      enriched = {
        ...enriched,
        relatedIds: MindTraceRelatedService.assignRelatedIds(
          enriched,
          peerItems || []
        ),
      };
    }
    return enriched;
  }

  /**
   * 迁移补全 tags / relatedIds
   * @param {InspirationRecord} item
   * @param {InspirationRecord[]} allItems
   * @returns {InspirationRecord}
   */
  function ensureCognitiveFields(item, allItems) {
    const peers = (allItems || []).filter((x) => x.id !== item.id);
    let base = item;
    let changed = false;
    if (!Array.isArray(base.tags) || !base.tags.length) {
      if (typeof MindTraceTagService !== 'undefined') {
        base = { ...base, tags: MindTraceTagService.assignTags(base) };
        changed = true;
      }
    }
    if (!Array.isArray(base.relatedIds)) {
      if (typeof MindTraceRelatedService !== 'undefined') {
        base = {
          ...base,
          relatedIds: MindTraceRelatedService.assignRelatedIds(base, peers),
        };
        changed = true;
      }
    }
    return { record: base, changed };
  }

  /**
   * 合并 IndexedDB 中的 embedding
   * @param {InspirationRecord[]} items
   * @returns {Promise<InspirationRecord[]>}
   */
  async function attachEmbeddings(items) {
    if (!items.length || typeof MindTraceEmbeddingStorage === 'undefined') {
      return items.map((item) => ({ ...item, embedding: null }));
    }

    await MindTraceEmbeddingStorage.migrateIfNeeded();
    const ids = items.map((item) => item.id);
    const embMap = await MindTraceEmbeddingStorage.getEmbeddingsBatch(ids);

    return items.map((item) => ({
      ...item,
      embedding: embMap[item.id] || null,
    }));
  }

  /**
   * 从 storage 读取原始数组（不排序）；旧数据缺 keywords 时补全并回写
   * @returns {Promise<Array>}
   */
  /**
   * 旧数据迁移：为无 gardenId 的思考归入默认花园
   * @param {InspirationRecord[]} items
   * @returns {Promise<{ items: InspirationRecord[], changed: boolean }>}
   */
  async function migrateThoughtGardenIds(items) {
    if (typeof MindTraceGardenService !== 'undefined') {
      await MindTraceGardenService.migrateIfNeeded();
    }
    const defaultId =
      typeof MindTraceGardenService !== 'undefined'
        ? MindTraceGardenService.DEFAULT_GARDEN_ID
        : 'garden-default';

    let changed = false;
    const migrated = (items || []).map((item) => {
      let base = stripEmbeddingForStorage(item);
      base = MindTraceUtils.normalizeRecord(base);
      if (!item.gardenId) {
        changed = true;
        base = { ...base, gardenId: defaultId };
      }
      return base;
    });

    return { items: migrated, changed };
  }

  async function getAllRaw() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let items = result[STORAGE_KEY] || [];
    let needsPersist = false;

    const gardenMigration = await migrateThoughtGardenIds(items);
    items = gardenMigration.items;
    if (gardenMigration.changed) {
      needsPersist = true;
    }

    items = items.map((item) => {
      let base = stripEmbeddingForStorage(item);
      base = MindTraceUtils.normalizeRecord(base);
      if (!Array.isArray(base.keywords)) {
        needsPersist = true;
        base = ensureKeywords(base);
      }
      if (
        !Array.isArray(item.images) ||
        typeof item.imageOCRText !== 'string'
      ) {
        needsPersist = true;
      }
      const cognitive = ensureCognitiveFields(base, items);
      if (cognitive.changed) {
        needsPersist = true;
        base = cognitive.record;
      }
      return base;
    });

    if (needsPersist && items.length > 0) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: items.map(stripEmbeddingForStorage),
      });
    }

    return attachEmbeddings(items);
  }

  /**
   * @param {string} [gardenId]
   * @returns {Promise<InspirationRecord[]>}
   */
  async function getAllForGarden(gardenId) {
    const items = await getAllRaw();
    if (!gardenId) {
      return items;
    }
    const resolved =
      typeof MindTraceGardenService !== 'undefined'
        ? MindTraceGardenService.resolveGardenId({ gardenId })
        : gardenId;
    return items.filter(
      (item) =>
        (typeof MindTraceGardenService !== 'undefined'
          ? MindTraceGardenService.resolveGardenId(item)
          : item.gardenId || 'garden-default') === resolved
    );
  }

  /**
   * 获取全部记录，按创建时间倒序
   * @returns {Promise<Array<InspirationRecord>>}
   */
  async function getAll(gardenId) {
    const items = gardenId ? await getAllForGarden(gardenId) : await getAllRaw();
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 保存一条新记录（插入到数组头部）
   * @param {InspirationRecord} record
   * @returns {Promise<InspirationRecord>}
   */
  /**
   * 将思维证据图片写入 IndexedDB，并返回 imageId 列表
   * @param {string} thoughtId
   * @param {Blob[]} blobs
   * @returns {Promise<string[]>}
   */
  async function persistEvidenceImages(thoughtId, blobs) {
    if (
      !thoughtId ||
      !blobs ||
      !blobs.length ||
      typeof MindTraceImageStorage === 'undefined'
    ) {
      return [];
    }

    await MindTraceImageStorage.migrateIfNeeded();
    const ids = [];
    for (const blob of blobs) {
      if (blob && blob.size) {
        const imageId = await MindTraceImageStorage.saveImage(thoughtId, blob);
        ids.push(imageId);
      }
    }
    return ids;
  }

  async function save(record, options) {
    const normalized = MindTraceUtils.normalizeRecord(record);
    if (!normalized.gardenId && typeof MindTraceGardenService !== 'undefined') {
      normalized.gardenId = await MindTraceGardenService.getCurrentGardenId();
    }
    if (!MindTraceUtils.hasRequiredThought(normalized)) {
      throw new Error('THOUGHT_CONTENT_REQUIRED');
    }

    const imageBlobs = (options && options.imageBlobs) || [];
    const imageIds = await persistEvidenceImages(normalized.id, imageBlobs);
    if (imageIds.length) {
      normalized.images = [...(normalized.images || []), ...imageIds];
      normalized.userEvidence = true;
    }

    const items = await getAllRaw();
    const enriched = enrichCognitiveFields(normalized, items);
    const forStorage = stripEmbeddingForStorage(enriched);
    items.unshift(forStorage);
    await chrome.storage.local.set({
      [STORAGE_KEY]: items.map(stripEmbeddingForStorage),
    });

    if (typeof MindTraceEmbeddingService !== 'undefined') {
      MindTraceEmbeddingService.scheduleEmbedding(enriched);
    }

    if (typeof MindTraceInsightService !== 'undefined') {
      MindTraceInsightService.onThoughtsChanged(enriched.gardenId);
    }

    return { ...enriched, embedding: null };
  }

  /**
   * 按 id 合并更新记录（保留 id、createdAt；写入 updatedAt）
   * @param {string} id
   * @param {Partial<InspirationRecord>} partialData
   * @returns {Promise<InspirationRecord>}
   */
  async function updateById(id, partialData) {
    const items = await getAllRaw();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Record not found: ${id}`);
    }

    const existing = items[index];
    const merged = MindTraceUtils.normalizeRecord({
      ...existing,
      ...partialData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    });

    if (
      partialData.note !== undefined &&
      !MindTraceUtils.hasRequiredThought(merged)
    ) {
      throw new Error('THOUGHT_CONTENT_REQUIRED');
    }

    if (!Array.isArray(merged.versionHistory)) {
      merged.versionHistory = [];
    }

    const peers = items.filter((x) => x.id !== id);
    const enriched = enrichCognitiveFields(merged, peers);
    const forStorage = stripEmbeddingForStorage(enriched);
    items[index] = forStorage;
    await chrome.storage.local.set({
      [STORAGE_KEY]: items.map(stripEmbeddingForStorage),
    });

    if (typeof MindTraceEmbeddingService !== 'undefined') {
      MindTraceEmbeddingService.scheduleEmbedding(enriched);
    }

    if (typeof MindTraceInsightService !== 'undefined') {
      MindTraceInsightService.onThoughtsChanged(enriched.gardenId);
    }

    return { ...enriched, embedding: null };
  }

  /**
   * 按 id 删除记录
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteById(id) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let items = result[STORAGE_KEY] || [];
    const removed = items.find((item) => item.id === id);
    const removedGardenId = removed
      ? typeof MindTraceGardenService !== 'undefined'
        ? MindTraceGardenService.resolveGardenId(removed)
        : removed.gardenId
      : null;
    items = items.filter((item) => item.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: items });

    if (typeof MindTraceEmbeddingStorage !== 'undefined') {
      await MindTraceEmbeddingStorage.deleteEmbedding(id);
    }
    if (typeof MindTraceImageStorage !== 'undefined') {
      await MindTraceImageStorage.deleteImagesForThought(id);
    }
    if (typeof MindTraceEmbeddingService !== 'undefined') {
      MindTraceEmbeddingService.invalidateRecord(id);
    }
    if (typeof MindTraceInsightService !== 'undefined') {
      MindTraceInsightService.onThoughtsChanged(removedGardenId);
    }
  }

  /**
   * 按 id 获取单条记录
   * @param {string} id
   * @returns {Promise<InspirationRecord|undefined>}
   */
  async function getById(id) {
    const items = await getAllRaw();
    return items.find((item) => item.id === id);
  }

  /**
   * 简单搜索：匹配原文、想法、页面标题
   * @param {string} query
   * @returns {Promise<Array<InspirationRecord>>}
   */
  /**
   * 将某花园下全部思考迁至另一花园（删除花园时调用）
   * @param {string} fromGardenId
   * @param {string} toGardenId
   * @returns {Promise<number>}
   */
  async function reassignGarden(fromGardenId, toGardenId) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let items = result[STORAGE_KEY] || [];
    let count = 0;
    items = items.map((item) => {
      const gid = item.gardenId || 'garden-default';
      if (gid === fromGardenId) {
        count += 1;
        return { ...item, gardenId: toGardenId };
      }
      return item;
    });
    if (count > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: items });
    }
    return count;
  }

  async function search(query, gardenId) {
    if (typeof MindTraceSearchService !== 'undefined') {
      const result = await MindTraceSearchService.search(query, gardenId);
      return result.items;
    }

    const items = gardenId ? await getAll(gardenId) : await getAll();
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      const fields = [
        item.selectedText,
        item.note,
        item.pageTitle,
        item.pageUrl,
      ];
      return fields.some(
        (f) => f && String(f).toLowerCase().includes(q)
      );
    });
  }

  /**
   * @param {string} query
   * @param {string|null} [gardenId]
   * @returns {Promise<{ items: InspirationRecord[], mode: string }>}
   */
  async function searchWithMeta(query, gardenId) {
    if (typeof MindTraceSearchService !== 'undefined') {
      return MindTraceSearchService.search(query, gardenId);
    }
    const items = await search(query, gardenId);
    const q = (query || '').trim();
    return { items, mode: q ? 'keyword' : 'none' };
  }

  /**
   * 清空全部（预留，popup 暂未暴露）
   * @returns {Promise<void>}
   */
  async function clearAll() {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }

  /**
   * 记录总数
   * @returns {Promise<number>}
   */
  async function count(gardenId) {
    if (gardenId) {
      const items = await getAllForGarden(gardenId);
      return items.length;
    }
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const items = result[STORAGE_KEY] || [];
    return items.length;
  }

  return {
    STORAGE_KEY,
    getAll,
    getAllRaw,
    getAllForGarden,
    reassignGarden,
    save,
    persistEvidenceImages,
    updateById,
    deleteById,
    getById,
    search,
    searchWithMeta,
    clearAll,
    count,
    ensureKeywords,
    withKeywords,
    stripEmbeddingForStorage,
  };
})();

/**
 * @typedef {Object} InspirationRecord
 * @property {string} id - 唯一标识
 * @property {string} gardenId - 所属认知花园
 * @property {string} selectedText - 用户划选的原文
 * @property {string} note - 用户的想法
 * @property {string} pageTitle - 来源网页标题
 * @property {string} pageUrl - 来源网页 URL
 * @property {number} createdAt - 创建时间戳（毫秒）
 * @property {number} [updatedAt] - 最近更新时间戳（毫秒）
 * @property {Array} [versionHistory] - 版本历史（预留）
 * @property {string[]} [keywords] - 本地提取的关键词，用于思维关联降级
 * @property {number[]|null} [embedding] - 384 维语义向量（运行时从 IndexedDB 合并，不持久化到 chrome.storage）
 * @property {string[]} [images] - 思维证据图片 ID 列表（Blob 存 IndexedDB）
 * @property {string} [imageOCRText] - 图片 OCR 文本（预留，暂不参与 embedding）
 * @property {string} [previewImageUrl] - 页面分享图 URL（旧版自动抓取，已不再写入）
 * @property {boolean} [userEvidence] - 灵感现场是否为用户主动添加（粘贴/截图/右键保存）
 * @property {string[]} [linkedThoughtIds] - 用户确认关联的旧思考 id
 */
