/**
 * MindTrace — Content Script
 * 划词记录、思维证据（粘贴/拖拽/右键图片/截图）、保存提示
 */

(function () {
  'use strict';

  if (window.__MINDTRACE_INJECTED__) {
    return;
  }
  window.__MINDTRACE_INJECTED__ = true;

  const ROOT_ID = 'mindtrace-root';
  const MIN_SELECTION_LENGTH = 2;
  const TOAST_DURATION = 2500;
  const MAX_EVIDENCE_IMAGES = 5;

  let currentSelectedText = '';
  /** @type {{ blob: Blob, previewUrl: string }[]} */
  let pendingEvidence = [];
  /** @type {'selection'|'image'} */
  let panelMode = 'selection';

  let rootEl = null;
  let triggerBtn = null;
  let panelEl = null;
  let toastEl = null;

  function init() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }

    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    rootEl.setAttribute('data-mindtrace', 'host');

    triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'mt-trigger-btn';
    triggerBtn.textContent = '记录灵感';
    triggerBtn.setAttribute('aria-label', '记录灵感到 MindTrace');
    triggerBtn.hidden = true;
    triggerBtn.addEventListener('click', onTriggerClick);

    panelEl = buildPanel();
    panelEl.hidden = true;

    toastEl = document.createElement('div');
    toastEl.className = 'mt-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.hidden = true;

    rootEl.appendChild(triggerBtn);
    rootEl.appendChild(panelEl);
    rootEl.appendChild(toastEl);

    document.documentElement.appendChild(rootEl);

    bindDocumentEvents();

    chrome.runtime.onMessage.addListener((message) => {
      if (!message || !message.type) {
        return;
      }
      if (message.type === 'mindtrace-open-image-save') {
        openImageSavePanel(message.srcUrl, {
          pageTitle: message.pageTitle,
          pageUrl: message.pageUrl,
        });
      }
    });
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'mt-panel';
    panel.innerHTML = `
      <div class="mt-panel-header">
        <div class="mt-panel-heading">
          <span class="mt-panel-title" data-ref="panel-title">记录灵感</span>
          <p class="mt-panel-subtitle" data-ref="panel-subtitle" hidden></p>
        </div>
        <button type="button" class="mt-panel-close" aria-label="关闭">×</button>
      </div>
      <div class="mt-panel-body">
        <div class="mt-quote-wrap" data-ref="quote-wrap">
          <label class="mt-label">原文</label>
          <blockquote class="mt-quote" data-ref="quote"></blockquote>
        </div>
        <div class="mt-garden-field" data-ref="garden-field">
          <label class="mt-label" for="mt-garden-select">认知花园</label>
          <select id="mt-garden-select" class="mt-garden-select" data-ref="garden-select" aria-label="选择认知花园"></select>
          <button type="button" class="mt-btn-link mt-garden-new" data-action="new-garden" title="快速开辟新花园">+ 新花园</button>
        </div>
        <label class="mt-label" for="mt-note-input" data-ref="note-label">随想</label>
        <textarea
          id="mt-note-input"
          class="mt-note-input"
          rows="4"
          placeholder="想到了什么……"
          data-ref="note"
        ></textarea>
        <div class="mt-evidence" data-ref="evidence-section">
          <label class="mt-label">灵感现场</label>
          <p class="mt-evidence-hint">粘贴或拖入都可以，帮以后想起当时的情境</p>
          <div class="mt-evidence-preview" data-ref="evidence-preview" hidden></div>
          <div class="mt-evidence-actions">
            <button type="button" class="mt-btn-link" data-action="capture-moment" title="截取当前可见网页">
              截取当前画面
            </button>
          </div>
        </div>
      </div>
      <div class="mt-panel-footer">
        <button type="button" class="mt-btn mt-btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="mt-btn mt-btn-primary" data-action="save">保存</button>
      </div>
    `;

    panel.querySelector('.mt-panel-close').addEventListener('click', hidePanel);
    panel.querySelector('[data-action="cancel"]').addEventListener('click', hidePanel);
    panel.querySelector('[data-action="save"]').addEventListener('click', onSaveClick);
    panel
      .querySelector('[data-action="new-garden"]')
      .addEventListener('click', onQuickCreateGardenClick);
    panel
      .querySelector('[data-action="capture-moment"]')
      .addEventListener('click', onCaptureMomentClick);

    const noteInput = panel.querySelector('[data-ref="note"]');
    noteInput.addEventListener('paste', onNotePaste);
    panel.addEventListener('dragover', onPanelDragOver);
    panel.addEventListener('dragleave', onPanelDragLeave);
    panel.addEventListener('drop', onPanelDrop);

    return panel;
  }

  function bindDocumentEvents() {
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hideTriggerButton, { passive: true });
    window.addEventListener('resize', hideTriggerButton, { passive: true });
  }

  function onMouseUp(event) {
    if (isInsideMindTraceUI(event.target)) {
      return;
    }

    requestAnimationFrame(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text.length < MIN_SELECTION_LENGTH) {
        hideTriggerButton();
        return;
      }

      if (isSelectionInEditable(selection)) {
        hideTriggerButton();
        return;
      }

      currentSelectedText = text;
      showTriggerButton(selection);
    });
  }

  function onMouseDown(event) {
    if (isInsideMindTraceUI(event.target)) {
      return;
    }
    if (!panelEl || panelEl.hidden) {
      return;
    }
    hidePanel();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      hidePanel();
      hideTriggerButton();
    }
  }

  function isSelectionInEditable(selection) {
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    let node = selection.anchorNode;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (node);
        if (
          el.isContentEditable ||
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT'
        ) {
          return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  }

  function isInsideMindTraceUI(target) {
    const host = document.getElementById(ROOT_ID);
    if (!host || !target) {
      return false;
    }
    return host.contains(/** @type {Node} */ (target));
  }

  function showTriggerButton(selection) {
    if (!triggerBtn || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      hideTriggerButton();
      return;
    }

    const btnWidth = 88;
    const btnHeight = 32;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.left + rect.width / 2 - btnWidth / 2;

    const maxLeft = window.innerWidth - btnWidth - padding;
    const minLeft = padding;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    if (rect.bottom + btnHeight + padding > window.innerHeight) {
      top = rect.top - btnHeight - padding;
    }

    triggerBtn.style.top = `${top}px`;
    triggerBtn.style.left = `${left}px`;
    triggerBtn.hidden = false;
  }

  function hideTriggerButton() {
    if (triggerBtn) {
      triggerBtn.hidden = true;
    }
  }

  function onTriggerClick(event) {
    event.stopPropagation();
    hideTriggerButton();
    openSelectionPanel();
  }

  function clearPendingEvidence() {
    pendingEvidence.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    pendingEvidence = [];
    renderEvidencePreview();
  }

  function setPanelMode(mode) {
    panelMode = mode;
    const titleEl = panelEl.querySelector('[data-ref="panel-title"]');
    const subtitleEl = panelEl.querySelector('[data-ref="panel-subtitle"]');
    const quoteWrap = panelEl.querySelector('[data-ref="quote-wrap"]');
    const noteLabel = panelEl.querySelector('[data-ref="note-label"]');
    const noteInput = panelEl.querySelector('[data-ref="note"]');

    if (mode === 'image') {
      if (titleEl) {
        titleEl.textContent = '留住这一瞬';
      }
      if (subtitleEl) {
        subtitleEl.textContent = '画面已经有了，写几句留给以后的自己';
        subtitleEl.hidden = false;
      }
      if (quoteWrap) {
        quoteWrap.hidden = true;
      }
      if (noteLabel) {
        noteLabel.textContent = '随想';
      }
      if (noteInput) {
        noteInput.placeholder = '它让你想到什么……';
      }
    } else {
      if (titleEl) {
        titleEl.textContent = '记录灵感';
      }
      if (subtitleEl) {
        subtitleEl.textContent = '';
        subtitleEl.hidden = true;
      }
      if (quoteWrap) {
        quoteWrap.hidden = false;
      }
      if (noteLabel) {
        noteLabel.textContent = '随想';
      }
      if (noteInput) {
        noteInput.placeholder = '想到了什么……';
      }
    }
  }

  function openSelectionPanel() {
    if (!panelEl) {
      return;
    }

    setPanelMode('selection');
    clearPendingEvidence();

    const quoteEl = panelEl.querySelector('[data-ref="quote"]');
    const noteInput = panelEl.querySelector('[data-ref="note"]');

    if (quoteEl) {
      quoteEl.textContent = currentSelectedText;
    }
    if (noteInput) {
      noteInput.value = '';
    }

    showPanel();
  }

  /**
   * @param {string} srcUrl
   * @param {{ pageTitle?: string, pageUrl?: string }} meta
   */
  async function openImageSavePanel(srcUrl, meta) {
    if (!panelEl) {
      return;
    }

    hideTriggerButton();
    setPanelMode('image');
    clearPendingEvidence();
    currentSelectedText = '';

    panelEl.dataset.pageTitle = meta.pageTitle || document.title;
    panelEl.dataset.pageUrl = meta.pageUrl || window.location.href;

    const noteInput = panelEl.querySelector('[data-ref="note"]');
    if (noteInput) {
      noteInput.value = '';
    }

    showPanel();

    try {
      const blob = await imageUrlToBlob(srcUrl);
      if (blob) {
        addEvidenceBlob(blob);
      } else {
        showToast('无法读取该图片，请尝试另存为后粘贴');
      }
    } catch (err) {
      console.warn('[MindTrace] image fetch failed:', err);
      showToast('无法读取该图片');
    }

    if (noteInput) {
      noteInput.focus();
    }
  }

  /**
   * 填充认知花园下拉（默认选中最近使用的花园）
   */
  async function populateGardenSelect() {
    if (!panelEl || typeof MindTraceGardenService === 'undefined') {
      return;
    }
    const select = panelEl.querySelector('[data-ref="garden-select"]');
    if (!select) {
      return;
    }
    try {
      await MindTraceGardenService.migrateIfNeeded();
      const gardens = await MindTraceGardenService.getGardens();
      const currentId = await MindTraceGardenService.getCurrentGardenId();
      select.innerHTML = gardens
        .map(
          (g) =>
            `<option value="${g.id.replace(/"/g, '&quot;')}">${(g.icon || '🌿') + ' ' + (g.name || '花园')}</option>`
        )
        .join('');
      select.value = currentId;
    } catch (err) {
      console.warn('[MindTrace] garden select load failed:', err);
    }
  }

  async function onQuickCreateGardenClick() {
    const name = window.prompt('新花园名称', '新花园');
    if (!name || !name.trim()) {
      return;
    }
    try {
      const garden = await MindTraceGardenService.createGarden({
        name: name.trim(),
      });
      await populateGardenSelect();
      const select = panelEl.querySelector('[data-ref="garden-select"]');
      if (select) {
        select.value = garden.id;
      }
      showToast(`已开辟「${garden.name}」`);
    } catch (err) {
      console.warn('[MindTrace] quick create garden failed:', err);
      showToast('创建花园失败');
    }
  }

  function showPanel() {
    populateGardenSelect();
    panelEl.style.top = `${Math.max(80, window.innerHeight * 0.12)}px`;
    panelEl.hidden = false;
    requestAnimationFrame(() => {
      const noteInput = panelEl.querySelector('[data-ref="note"]');
      if (noteInput) {
        noteInput.focus();
      }
    });
  }

  function hidePanel() {
    if (panelEl) {
      panelEl.hidden = true;
    }
    clearPendingEvidence();
  }

  /**
   * @param {Blob} blob
   */
  function addEvidenceBlob(blob) {
    if (!blob || !blob.type.startsWith('image/')) {
      return;
    }
    if (pendingEvidence.length >= MAX_EVIDENCE_IMAGES) {
      showToast(`最多保存 ${MAX_EVIDENCE_IMAGES} 张灵感现场`);
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    pendingEvidence.push({ blob, previewUrl });
    renderEvidencePreview();
  }

  function renderEvidencePreview() {
    const wrap = panelEl.querySelector('[data-ref="evidence-preview"]');
    if (!wrap) {
      return;
    }

    if (!pendingEvidence.length) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }

    wrap.hidden = false;
    wrap.innerHTML = pendingEvidence
      .map(
        (item, index) =>
          `<div class="mt-evidence-thumb-wrap">
            <img class="mt-evidence-thumb" src="${item.previewUrl}" alt="灵感现场预览" />
            <button type="button" class="mt-evidence-remove" data-index="${index}" aria-label="移除">×</button>
          </div>`
      )
      .join('');

    wrap.querySelectorAll('.mt-evidence-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-index'));
        const removed = pendingEvidence.splice(idx, 1)[0];
        if (removed && removed.previewUrl) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        renderEvidencePreview();
      });
    });
  }

  function onNotePaste(event) {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) {
      return;
    }

    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        hasImage = true;
        const file = item.getAsFile();
        if (file) {
          addEvidenceBlob(file);
        }
      }
    }

    if (hasImage) {
      event.preventDefault();
    }
  }

  function onPanelDragOver(event) {
    if (!hasFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    panelEl.classList.add('mt-panel-dragover');
  }

  function onPanelDragLeave(event) {
    event.stopPropagation();
    panelEl.classList.remove('mt-panel-dragover');
  }

  function onPanelDrop(event) {
    if (!hasFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    panelEl.classList.remove('mt-panel-dragover');

    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files) {
      return;
    }

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        addEvidenceBlob(file);
      }
    }
  }

  function hasFileDrag(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    return types && Array.from(types).includes('Files');
  }

  async function onCaptureMomentClick() {
    const saveBtn = panelEl.querySelector('[data-action="capture-moment"]');
    if (saveBtn) {
      saveBtn.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'mindtrace-capture-visible-tab',
      });

      if (!response || !response.ok || !response.dataUrl) {
        showToast('截图失败，请确认已激活该标签页');
        return;
      }

      const blob = await dataUrlToBlob(response.dataUrl);
      addEvidenceBlob(blob);
      showToast('已捕获当前页面画面');
    } catch (err) {
      console.warn('[MindTrace] capture moment failed:', err);
      showToast('截图失败');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
      }
    }
  }

  /**
   * @param {string} dataUrl
   * @returns {Promise<Blob>}
   */
  function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then((r) => r.blob());
  }

  /**
   * @param {string} url
   * @returns {Promise<Blob|null>}
   */
  async function imageUrlToBlob(url) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.blob();
      }
    } catch (_e) {
      /* cross-origin: try canvas */
    }

    const img = await loadImageElement(url);
    if (!img) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.drawImage(img, 0, 0);
      return await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (err) {
      console.warn('[MindTrace] canvas export failed:', err);
      return null;
    }
  }

  /**
   * @param {string} url
   * @returns {Promise<HTMLImageElement|null>}
   */
  function loadImageElement(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const fallback = Array.from(document.images).find(
          (el) => el.src === url || el.currentSrc === url
        );
        if (fallback && fallback.complete) {
          resolve(fallback);
        } else {
          resolve(null);
        }
      };
      img.src = url;
    });
  }

  async function onSaveClick() {
    const noteInput = panelEl.querySelector('[data-ref="note"]');
    const note = noteInput ? noteInput.value.trim() : '';

    if (!note) {
      showToast('写几个字再保存吧，以后才好找回来');
      if (noteInput) {
        noteInput.focus();
      }
      return;
    }

    const pageTitle =
      panelMode === 'image' && panelEl.dataset.pageTitle
        ? panelEl.dataset.pageTitle
        : document.title;
    const pageUrl =
      panelMode === 'image' && panelEl.dataset.pageUrl
        ? panelEl.dataset.pageUrl
        : window.location.href;

    const gardenSelect = panelEl.querySelector('[data-ref="garden-select"]');
    const gardenId =
      gardenSelect && gardenSelect.value
        ? gardenSelect.value
        : await MindTraceGardenService.getCurrentGardenId();

    if (typeof MindTraceGardenService !== 'undefined' && gardenId) {
      await MindTraceGardenService.setCurrentGardenId(gardenId);
    }

    const record = MindTraceUtils.buildRecord({
      selectedText: panelMode === 'selection' ? currentSelectedText : '',
      note,
      pageTitle,
      pageUrl,
      gardenId,
    });

    const saveBtn = panelEl.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
    }

    const blobs = pendingEvidence.map((item) => item.blob);

    try {
      await MindTraceStorage.save(record, { imageBlobs: blobs });
      hidePanel();
      showToast('✓ 已保存到 MindTrace');
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('[MindTrace] 保存失败:', err);
      if (err && err.message === 'THOUGHT_CONTENT_REQUIRED') {
        showToast('写几个字再保存吧');
      } else {
        showToast('保存失败，请重试');
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    }
  }

  function showToast(message) {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add('mt-toast-visible');

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove('mt-toast-visible');
      toastEl.hidden = true;
    }, TOAST_DURATION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
