/**
 * MindTrace — MV3 Service Worker
 * 在用户点击扩展（activeTab）后，向当前标签页动态注入划词脚本。
 */

'use strict';

/** @type {readonly string[]} */
const CONTENT_SCRIPT_FILES = [
  'utils.js',
  'services/keyword.service.js',
  'storage.js',
  'content.js',
];

/**
 * @param {number} tabId
 * @returns {Promise<{ ok: boolean, already?: boolean, reason?: string }>}
 */
async function injectContentScripts(tabId) {
  if (!tabId) {
    return { ok: false, reason: 'no_tab' };
  }

  try {
    const [{ result: alreadyInjected }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.__MINDTRACE_INJECTED__),
    });

    if (alreadyInjected) {
      return { ok: true, already: true };
    }

    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css'],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES,
    });

    return { ok: true, already: false };
  } catch (err) {
    console.warn('[MindTrace] 动态注入失败:', err);
    return { ok: false, reason: 'inject_failed' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'inject-content') {
    return false;
  }

  const tabId = message.tabId;
  injectContentScripts(tabId).then(sendResponse);
  return true;
});
