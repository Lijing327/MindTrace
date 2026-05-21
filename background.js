/**
 * MindTrace — MV3 Service Worker
 * 动态注入划词脚本、右键保存图片、可见区域截图
 */

'use strict';

/** @type {readonly string[]} */
const CONTENT_SCRIPT_FILES = [
  'utils.js',
  'services/keyword.service.js',
  'services/image-storage.service.js',
  'storage.js',
  'content.js',
];

const CONTEXT_MENU_IMAGE_ID = 'mindtrace-save-image';

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

/**
 * @param {number} tabId
 * @param {Object} payload
 * @returns {Promise<boolean>}
 */
async function sendToTab(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
    return true;
  } catch (_err) {
    const injected = await injectContentScripts(tabId);
    if (!injected.ok) {
      return false;
    }
    try {
      await chrome.tabs.sendMessage(tabId, payload);
      return true;
    } catch (err2) {
      console.warn('[MindTrace] sendMessage failed:', err2);
      return false;
    }
  }
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IMAGE_ID,
      title: '保存到 MindTrace',
      contexts: ['image'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_IMAGE_ID || !tab || !tab.id) {
    return;
  }

  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    return;
  }

  await sendToTab(tab.id, {
    type: 'mindtrace-open-image-save',
    srcUrl,
    pageTitle: tab.title || '',
    pageUrl: tab.url || '',
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'inject-content') {
    const tabId = message.tabId;
    injectContentScripts(tabId).then(sendResponse);
    return true;
  }

  if (message.type === 'mindtrace-capture-visible-tab') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ ok: false, reason: 'no_tab' });
      return false;
    }

    chrome.tabs
      .captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl) => {
        sendResponse({ ok: true, dataUrl });
      })
      .catch((err) => {
        console.warn('[MindTrace] captureVisibleTab failed:', err);
        sendResponse({ ok: false, reason: 'capture_failed' });
      });
    return true;
  }

  return false;
});
