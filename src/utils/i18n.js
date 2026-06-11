/**
 * MindTrace — 统一国际化工具
 * 封装 chrome.i18n.getMessage，并提供页面静态文案注入
 */
const MindTraceI18n = (function () {
  'use strict';

  const LOCALE_PREF_KEY = 'mindtrace_locale_pref';

  /**
   * @param {string} lang
   * @returns {'zh_CN'|'en'}
   */
  function normalizeNavigatorLang(lang) {
    const value = String(lang || '').toLowerCase();
    if (value === 'zh' || value.startsWith('zh-')) {
      return 'zh_CN';
    }
    return 'en';
  }

  /**
   * @returns {boolean}
   */
  function isChineseUILocale() {
    try {
      const ui = chrome.i18n.getUILanguage().toLowerCase();
      return ui === 'zh' || ui.startsWith('zh-');
    } catch (_err) {
      const nav =
        typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
      return normalizeNavigatorLang(nav) === 'zh_CN';
    }
  }

  /**
   * @returns {'zh-CN'|'en-US'}
   */
  function getDateLocale() {
    return isChineseUILocale() ? 'zh-CN' : 'en-US';
  }

  /**
   * @returns {'zh-CN'|'en'}
   */
  function getHtmlLang() {
    return isChineseUILocale() ? 'zh-CN' : 'en';
  }

  /**
   * @param {string} key
   * @param {string|string[]|number|undefined|null} substitutions
   * @returns {string}
   */
  function getText(key, substitutions) {
    if (!key) {
      return '';
    }
    if (substitutions === undefined || substitutions === null) {
      return chrome.i18n.getMessage(key) || key;
    }
    const subs = Array.isArray(substitutions)
      ? substitutions.map(String)
      : [String(substitutions)];
    return chrome.i18n.getMessage(key, subs) || key;
  }

  /**
   * @param {ParentNode|null|undefined} root
   */
  function applyPageI18n(root) {
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const text = getText(el.getAttribute('data-i18n'));
      if (text) {
        el.textContent = text;
      }
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = getText(el.getAttribute('data-i18n-placeholder'));
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = getText(el.getAttribute('data-i18n-title'));
    });

    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', getText(el.getAttribute('data-i18n-aria')));
    });

    scope.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('alt', getText(el.getAttribute('data-i18n-alt')));
    });

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = getText(el.getAttribute('data-i18n-html'));
    });

    if (scope === document && document.documentElement) {
      document.documentElement.lang = getHtmlLang();
    }
  }

  /**
   * 首次安装时记录浏览器语言偏好（zh* → zh_CN，其它 → en）
   * @returns {Promise<void>}
   */
  async function initLocaleOnFirstLaunch() {
    try {
      const data = await chrome.storage.local.get(LOCALE_PREF_KEY);
      if (data[LOCALE_PREF_KEY]) {
        return;
      }
      const pref = normalizeNavigatorLang(
        typeof navigator !== 'undefined' ? navigator.language : 'en'
      );
      await chrome.storage.local.set({ [LOCALE_PREF_KEY]: pref });
    } catch (_err) {
      /* ignore */
    }
  }

  return {
    getText,
    applyPageI18n,
    getDateLocale,
    getHtmlLang,
    isChineseUILocale,
    initLocaleOnFirstLaunch,
    normalizeNavigatorLang,
    LOCALE_PREF_KEY,
  };
})();

/** @type {typeof MindTraceI18n.getText} */
function getText(key, substitutions) {
  return MindTraceI18n.getText(key, substitutions);
}
