/**
 * MindTrace — 通用工具函数
 * 在 content script 与 popup 中复用
 */

const MindTraceUtils = (function () {
  /**
   * 生成唯一 ID
   * @returns {string}
   */
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * @returns {'zh-CN'|'en-US'}
   */
  function getDateLocale() {
    if (typeof MindTraceI18n !== 'undefined' && MindTraceI18n.getDateLocale) {
      return MindTraceI18n.getDateLocale();
    }
    try {
      const ui = chrome.i18n.getUILanguage().toLowerCase();
      return ui === 'zh' || ui.startsWith('zh-') ? 'zh-CN' : 'en-US';
    } catch (_err) {
      const nav = navigator.language || 'en';
      return nav.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
    }
  }

  /**
   * 格式化时间（按浏览器语言）
   * @param {number} timestamp
   * @returns {string}
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const locale = getDateLocale();
    if (locale === 'zh-CN') {
      return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 相对简短的时间显示（用于列表）
   * @param {number} timestamp
   * @returns {string}
   */
  function formatDateShort(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const locale = getDateLocale();

    if (isToday) {
      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    if (locale === 'zh-CN') {
      return date.toLocaleDateString(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * HTML 转义，防止 XSS
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (text == null) {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * 截断过长文本
   * @param {string} text
   * @param {number} maxLen
   * @returns {string}
   */
  function truncate(text, maxLen) {
    if (!text) {
      return '';
    }
    const str = String(text);
    if (str.length <= maxLen) {
      return str;
    }
    return str.slice(0, maxLen) + '…';
  }

  /**
   * 防抖
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 构建一条完整的灵感记录对象
   * @param {Object} params
   * @returns {InspirationRecord}
   */
  /**
   * 认知主体（content）是否有效：
   * 允许「随想 / 原文 / 灵感现场图片」任一项存在
   * @param {InspirationRecord|Object} record
   * @returns {boolean}
   */
  function hasRequiredThought(record) {
    if (!record) {
      return false;
    }
    const note = (record.note || record.content || '').trim();
    const selectedText = (record.selectedText || '').trim();
    const hasImages = Array.isArray(record.images) && record.images.length > 0;
    const previewImageUrl = (record.previewImageUrl || '').trim();
    return Boolean(note || selectedText || hasImages || previewImageUrl);
  }

  /**
   * 规范化记录字段（向下兼容）
   * @param {InspirationRecord} record
   * @returns {InspirationRecord}
   */
  function normalizeRecord(record) {
    if (!record) {
      return record;
    }
    const images = Array.isArray(record.images) ? record.images.filter(Boolean) : [];
    const defaultGardenId =
      typeof MindTraceGardenService !== 'undefined'
        ? MindTraceGardenService.DEFAULT_GARDEN_ID
        : 'garden-default';
    const previewImageUrl =
      typeof record.previewImageUrl === 'string'
        ? record.previewImageUrl.trim()
        : '';
    const linkedThoughtIds = Array.isArray(record.linkedThoughtIds)
      ? record.linkedThoughtIds.filter(Boolean)
      : [];
    const tags = Array.isArray(record.tags)
      ? record.tags.filter(Boolean).map((t) => String(t).trim()).filter(Boolean)
      : [];
    const relatedIds = Array.isArray(record.relatedIds)
      ? record.relatedIds.filter(Boolean)
      : [];

    return {
      ...record,
      gardenId: record.gardenId || defaultGardenId,
      images,
      imageOCRText:
        typeof record.imageOCRText === 'string' ? record.imageOCRText : '',
      previewImageUrl,
      userEvidence: record.userEvidence === true,
      linkedThoughtIds,
      tags,
      relatedIds,
    };
  }

  function buildRecord(params) {
    const defaultGardenId =
      typeof MindTraceGardenService !== 'undefined'
        ? MindTraceGardenService.DEFAULT_GARDEN_ID
        : 'garden-default';
    return normalizeRecord({
      id: generateId(),
      gardenId: (params && params.gardenId) || defaultGardenId,
      selectedText: params.selectedText || '',
      note: params.note || params.content || '',
      pageTitle: params.pageTitle || '',
      pageUrl: params.pageUrl || '',
      createdAt: Date.now(),
      images: params.images || [],
      imageOCRText: params.imageOCRText || '',
      previewImageUrl: (params && params.previewImageUrl) || '',
      userEvidence: Boolean(params && params.userEvidence),
      linkedThoughtIds:
        params && Array.isArray(params.linkedThoughtIds)
          ? params.linkedThoughtIds.filter(Boolean)
          : [],
      tags:
        params && Array.isArray(params.tags)
          ? params.tags.filter(Boolean)
          : [],
      relatedIds:
        params && Array.isArray(params.relatedIds)
          ? params.relatedIds.filter(Boolean)
          : [],
    });
  }

  return {
    generateId,
    getDateLocale,
    formatDate,
    formatDateShort,
    escapeHtml,
    truncate,
    debounce,
    hasRequiredThought,
    normalizeRecord,
    buildRecord,
  };
})();
