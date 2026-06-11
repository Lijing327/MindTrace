/**
 * MindTrace — MV3 Service Worker
 * 动态注入划词脚本、右键保存图片、可见区域截图
 */

'use strict';

importScripts('src/utils/i18n.js', 'services/preview.service.js');

/** @type {readonly string[]} */
const CONTENT_SCRIPT_FILES = [
  'src/utils/i18n.js',
  'utils.js',
  'services/garden.service.js',
  'services/keyword.service.js',
  'services/similarity.service.js',
  'services/vector.service.js',
  'services/tag.service.js',
  'services/related.service.js',
  'services/relation.service.js',
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
      title: chrome.i18n.getMessage('saveToMindTrace'),
      contexts: ['image'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  MindTraceI18n.initLocaleOnFirstLaunch();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) {
    return;
  }

  const injected = await injectContentScripts(tab.id);
  if (!injected.ok) {
    return;
  }

  if (command === 'capture-selection') {
    await sendToTab(tab.id, { type: 'mindtrace-open-selection' });
  } else if (command === 'quick-note') {
    await sendToTab(tab.id, { type: 'mindtrace-open-quick-note' });
  }
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

  if (message.type === 'mindtrace-fetch-page-preview') {
    const pageUrl = message.pageUrl;
    if (!pageUrl || typeof MindTracePreviewService === 'undefined') {
      sendResponse({ ok: false, reason: 'invalid' });
      return false;
    }

    MindTracePreviewService.fetchPagePreviewUrl(pageUrl)
      .then((previewImageUrl) => {
        sendResponse({
          ok: Boolean(previewImageUrl),
          previewImageUrl: previewImageUrl || '',
        });
      })
      .catch((err) => {
        console.warn('[MindTrace] fetch page preview failed:', err);
        sendResponse({ ok: false, reason: 'fetch_failed' });
      });
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
