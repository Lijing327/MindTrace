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
   * 格式化时间（中文 locale）
   * @param {number} timestamp
   * @returns {string}
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
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
  function buildRecord(params) {
    return {
      id: generateId(),
      selectedText: params.selectedText || '',
      note: params.note || '',
      pageTitle: params.pageTitle || '',
      pageUrl: params.pageUrl || '',
      createdAt: Date.now(),
    };
  }

  return {
    generateId,
    formatDate,
    formatDateShort,
    escapeHtml,
    truncate,
    debounce,
    buildRecord,
  };
})();
