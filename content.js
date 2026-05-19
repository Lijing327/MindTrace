/**
 * MindTrace — Content Script
 * 负责：划词检测、浮动按钮、记录弹窗、保存提示
 */

(function () {
  'use strict';

  if (window.__MINDTRACE_INJECTED__) {
    return;
  }
  window.__MINDTRACE_INJECTED__ = true;

  /** 根容器 ID，避免与页面冲突 */
  const ROOT_ID = 'mindtrace-root';

  /** 最小选中文本长度（字符） */
  const MIN_SELECTION_LENGTH = 2;

  /** Toast 显示时长（毫秒） */
  const TOAST_DURATION = 2500;

  /** 当前选中的文本 */
  let currentSelectedText = '';

  /** DOM 引用 */
  let rootEl = null;
  let triggerBtn = null;
  let panelEl = null;
  let toastEl = null;

  /**
   * 初始化 UI 容器
   */
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
  }

  /**
   * 构建记录弹窗 DOM
   * @returns {HTMLElement}
   */
  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'mt-panel';
    panel.innerHTML = `
      <div class="mt-panel-header">
        <span class="mt-panel-title">记录灵感</span>
        <button type="button" class="mt-panel-close" aria-label="关闭">×</button>
      </div>
      <div class="mt-panel-body">
        <label class="mt-label">原文</label>
        <blockquote class="mt-quote" data-ref="quote"></blockquote>
        <label class="mt-label" for="mt-note-input">我的想法</label>
        <textarea
          id="mt-note-input"
          class="mt-note-input"
          rows="4"
          placeholder="这一刻的想法…"
          data-ref="note"
        ></textarea>
      </div>
      <div class="mt-panel-footer">
        <button type="button" class="mt-btn mt-btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="mt-btn mt-btn-primary" data-action="save">保存</button>
      </div>
    `;

    panel.querySelector('.mt-panel-close').addEventListener('click', hidePanel);
    panel.querySelector('[data-action="cancel"]').addEventListener('click', hidePanel);
    panel.querySelector('[data-action="save"]').addEventListener('click', onSaveClick);

    return panel;
  }

  /**
   * 绑定文档级事件
   */
  function bindDocumentEvents() {
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hideTriggerButton, { passive: true });
    window.addEventListener('resize', hideTriggerButton, { passive: true });
  }

  /**
   * 鼠标抬起：检测是否有有效选区
   */
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

  /**
   * 鼠标按下：点击 UI 外部时关闭面板
   */
  function onMouseDown(event) {
    if (isInsideMindTraceUI(event.target)) {
      return;
    }
    if (!panelEl || panelEl.hidden) {
      return;
    }
    hidePanel();
  }

  /**
   * ESC 关闭面板与按钮
   */
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      hidePanel();
      hideTriggerButton();
    }
  }

  /**
   * 判断选区是否在可编辑区域内
   */
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

  /**
   * 事件是否发生在 MindTrace UI 内
   */
  function isInsideMindTraceUI(target) {
    const host = document.getElementById(ROOT_ID);
    if (!host || !target) {
      return false;
    }
    return host.contains(/** @type {Node} */ (target));
  }

  /**
   * 在选区附近显示「记录灵感」按钮
   */
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
    openPanel();
  }

  function openPanel() {
    if (!panelEl) {
      return;
    }

    const quoteEl = panelEl.querySelector('[data-ref="quote"]');
    const noteInput = panelEl.querySelector('[data-ref="note"]');

    if (quoteEl) {
      quoteEl.textContent = currentSelectedText;
    }
    if (noteInput) {
      noteInput.value = '';
    }

    panelEl.style.top = `${Math.max(80, window.innerHeight * 0.12)}px`;
    panelEl.hidden = false;

    requestAnimationFrame(() => {
      if (noteInput) {
        noteInput.focus();
      }
    });
  }

  function hidePanel() {
    if (panelEl) {
      panelEl.hidden = true;
    }
  }

  async function onSaveClick() {
    const noteInput = panelEl.querySelector('[data-ref="note"]');
    const note = noteInput ? noteInput.value.trim() : '';

    const record = MindTraceUtils.buildRecord({
      selectedText: currentSelectedText,
      note: note,
      pageTitle: document.title,
      pageUrl: window.location.href,
    });

    const saveBtn = panelEl.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
    }

    try {
      await MindTraceStorage.save(record);
      hidePanel();
      showToast('✓ 已保存到 MindTrace');
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('[MindTrace] 保存失败:', err);
      showToast('保存失败，请重试');
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
