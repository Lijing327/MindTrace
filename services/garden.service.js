/**
 * MindTrace — Cognitive Garden（认知花园）
 * 每个 Garden 为独立语义宇宙；数据仅存 chrome.storage.local
 */

const MindTraceGardenService = (function () {
  'use strict';

  const STORAGE_KEY = 'mindtrace_gardens';
  const CURRENT_GARDEN_KEY = 'mindtrace_current_garden_id';
  const DEFAULT_GARDEN_ID = 'garden-default';
  const DEFAULT_GARDEN_NAME = '默认花园';

  /** @type {boolean} */
  let migrationDone = false;

  /**
   * @returns {Garden}
   */
  function buildDefaultGarden() {
    return {
      id: DEFAULT_GARDEN_ID,
      name: DEFAULT_GARDEN_NAME,
      description: '你的第一片认知宇宙，过往思考会落在这里',
      icon: '🌱',
      color: '#6b8cce',
      createdAt: Date.now(),
      crossGardenRelations: [],
    };
  }

  /**
   * @param {Garden} garden
   * @returns {Garden}
   */
  function normalizeGarden(garden) {
    if (!garden || !garden.id) {
      return buildDefaultGarden();
    }
    return {
      id: String(garden.id),
      name: (garden.name || DEFAULT_GARDEN_NAME).trim() || DEFAULT_GARDEN_NAME,
      description: typeof garden.description === 'string' ? garden.description : '',
      icon: garden.icon || '🌿',
      color: garden.color || '#6b8cce',
      createdAt: Number.isFinite(garden.createdAt) ? garden.createdAt : Date.now(),
      crossGardenRelations: Array.isArray(garden.crossGardenRelations)
        ? garden.crossGardenRelations
        : [],
    };
  }

  /**
   * @returns {Promise<Garden[]>}
   */
  async function getGardens() {
    await migrateIfNeeded();
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const list = result[STORAGE_KEY] || [];
    return list.map(normalizeGarden);
  }

  /**
   * @param {string} id
   * @returns {Promise<Garden|undefined>}
   */
  async function getGardenById(id) {
    const gardens = await getGardens();
    return gardens.find((g) => g.id === id);
  }

  /**
   * @returns {Promise<string>}
   */
  async function getCurrentGardenId() {
    await migrateIfNeeded();
    const result = await chrome.storage.local.get(CURRENT_GARDEN_KEY);
    const id = result[CURRENT_GARDEN_KEY];
    if (id) {
      const gardens = await getGardens();
      if (gardens.some((g) => g.id === id)) {
        return id;
      }
    }
    return DEFAULT_GARDEN_ID;
  }

  /**
   * @param {string} gardenId
   * @returns {Promise<void>}
   */
  async function setCurrentGardenId(gardenId) {
    if (!gardenId) {
      return;
    }
    await chrome.storage.local.set({ [CURRENT_GARDEN_KEY]: gardenId });
  }

  /**
   * @param {Partial<Garden>} params
   * @returns {Promise<Garden>}
   */
  async function createGarden(params) {
    const gardens = await getGardens();
    const garden = normalizeGarden({
      id:
        (params && params.id) ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: (params && params.name) || '新花园',
      description: (params && params.description) || '',
      icon: (params && params.icon) || '✨',
      color: (params && params.color) || '#8b7fd4',
      createdAt: Date.now(),
      crossGardenRelations: [],
    });
    gardens.push(garden);
    await chrome.storage.local.set({ [STORAGE_KEY]: gardens });
    await setCurrentGardenId(garden.id);
    return garden;
  }

  /**
   * @param {string} id
   * @param {Partial<Garden>} partial
   * @returns {Promise<Garden>}
   */
  async function updateGarden(id, partial) {
    const gardens = await getGardens();
    const index = gardens.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Garden not found: ${id}`);
    }
    const updated = normalizeGarden({
      ...gardens[index],
      ...partial,
      id: gardens[index].id,
      createdAt: gardens[index].createdAt,
      crossGardenRelations:
        partial && partial.crossGardenRelations !== undefined
          ? partial.crossGardenRelations
          : gardens[index].crossGardenRelations,
    });
    gardens[index] = updated;
    await chrome.storage.local.set({ [STORAGE_KEY]: gardens });
    return updated;
  }

  /**
   * 删除花园：思考迁至默认花园；不可删默认花园
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteGarden(id) {
    if (id === DEFAULT_GARDEN_ID) {
      throw new Error('CANNOT_DELETE_DEFAULT_GARDEN');
    }

    const gardens = (await getGardens()).filter((g) => g.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: gardens });

    if (typeof MindTraceStorage !== 'undefined') {
      await MindTraceStorage.reassignGarden(id, DEFAULT_GARDEN_ID);
    }

    const current = await getCurrentGardenId();
    if (current === id) {
      await setCurrentGardenId(DEFAULT_GARDEN_ID);
    }
  }

  /**
   * 确保默认花园存在
   * @returns {Promise<void>}
   */
  async function migrateIfNeeded() {
    if (migrationDone) {
      return;
    }

    const result = await chrome.storage.local.get(STORAGE_KEY);
    let gardens = (result[STORAGE_KEY] || []).map(normalizeGarden);
    let changed = false;

    if (!gardens.some((g) => g.id === DEFAULT_GARDEN_ID)) {
      gardens.unshift(buildDefaultGarden());
      changed = true;
    }

    if (changed || !result[STORAGE_KEY]) {
      await chrome.storage.local.set({ [STORAGE_KEY]: gardens });
    }

    const currentResult = await chrome.storage.local.get(CURRENT_GARDEN_KEY);
    if (!currentResult[CURRENT_GARDEN_KEY]) {
      await chrome.storage.local.set({
        [CURRENT_GARDEN_KEY]: DEFAULT_GARDEN_ID,
      });
    }

    migrationDone = true;
  }

  /**
   * @param {InspirationRecord|Object|null|undefined} record
   * @returns {string}
   */
  function resolveGardenId(record) {
    if (record && record.gardenId) {
      return String(record.gardenId);
    }
    return DEFAULT_GARDEN_ID;
  }

  /**
   * @param {InspirationRecord|Object} a
   * @param {InspirationRecord|Object} b
   * @returns {boolean}
   */
  function sameGarden(a, b) {
    return resolveGardenId(a) === resolveGardenId(b);
  }

  return {
    STORAGE_KEY,
    CURRENT_GARDEN_KEY,
    DEFAULT_GARDEN_ID,
    DEFAULT_GARDEN_NAME,
    migrateIfNeeded,
    getGardens,
    getGardenById,
    getCurrentGardenId,
    setCurrentGardenId,
    createGarden,
    updateGarden,
    deleteGarden,
    resolveGardenId,
    sameGarden,
    buildDefaultGarden,
    normalizeGarden,
  };
})();

/**
 * @typedef {Object} Garden
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 * @property {string} color
 * @property {number} createdAt
 * @property {Array} crossGardenRelations - 跨花园关联（预留）
 */
