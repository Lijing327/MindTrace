/**
 * MindTrace — Popup 页面逻辑
 * 展示最近 5 条记录，支持就地删除；长期管理请打开灵感库
 */

(function () {
  'use strict';

  /** popup 最多展示条数 */
  const RECENT_LIMIT = 5;

  const listContainer = document.getElementById('list-container');
  const exportMdBtn = document.getElementById('export-md-btn');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');

  /** 记录之间的 Markdown 分隔线 */
  const RECORD_SEPARATOR = '==================================================';

  /**
   * 用户点击扩展图标后，向当前页注入划词脚本（activeTab + scripting）
   */
  async function injectSelectionCapture() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || tab.id == null) {
        return;
      }
      await chrome.runtime.sendMessage({
        type: 'inject-content',
        tabId: tab.id,
      });
    } catch (err) {
      console.warn('[MindTrace Popup] 划词脚本注入失败:', err);
    }
  }

  /**
   * 初始化
   */
  async function init() {
    await injectSelectionCapture();
    await loadAndRender();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MindTraceStorage.STORAGE_KEY]) {
        loadAndRender();
      }
    });

    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', onExportMarkdownClick);
    }

    if (openDashboardBtn) {
      openDashboardBtn.addEventListener('click', openDashboard);
    }

    listContainer.addEventListener('click', onListClick);
  }

  /**
   * 加载最近 5 条并渲染
   */
  async function loadAndRender() {
    try {
      await MindTraceGardenService.migrateIfNeeded();
      const gardenId = await MindTraceGardenService.getCurrentGardenId();
      const garden = await MindTraceGardenService.getGardenById(gardenId);
      const all = await MindTraceStorage.getAll(gardenId);
      const recent = all.slice(0, RECENT_LIMIT);
      renderList(recent, all.length, garden);
    } catch (err) {
      console.error('[MindTrace Popup] 加载失败:', err);
      listContainer.innerHTML =
        '<div class="list-empty"><p>加载失败，请关闭后重试</p></div>';
    }
  }

  /**
   * 打开灵感库 dashboard 标签页
   */
  function openDashboard() {
    window.open(chrome.runtime.getURL('dashboard.html'), '_blank');
  }

  /**
   * 渲染列表
   * @param {Array} items
   * @param {number} totalCount
   */
  function renderList(items, totalCount, garden) {
    const gardenHint = garden
      ? `<p class="list-garden-hint">${MindTraceUtils.escapeHtml(garden.icon || '🌿')} ${MindTraceUtils.escapeHtml(garden.name)}</p>`
      : '';

    if (!items.length) {
      listContainer.innerHTML = `
        ${gardenHint}
        <div class="list-empty">
          <div class="list-empty-icon">✦</div>
          <p>当前花园还没有记录<br/>先点击扩展图标，再在网页划词并点「记录灵感」</p>
        </div>
      `;
      return;
    }

    let html = gardenHint + items.map((item) => renderCard(item)).join('');

    if (totalCount > RECENT_LIMIT) {
      html += `
        <p class="list-more-hint">还有 ${totalCount - RECENT_LIMIT} 条，请在灵感库查看</p>
      `;
    }

    listContainer.innerHTML = html;
  }

  /**
   * 渲染单条预览卡片
   * @param {InspirationRecord} item
   * @returns {string}
   */
  /**
   * 列表点击：删除记录
   * @param {MouseEvent} event
   */
  async function onListClick(event) {
    const btn = event.target.closest('[data-delete-id]');
    if (!btn) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const id = btn.getAttribute('data-delete-id');
    if (!id) {
      return;
    }

    if (!confirm('确定删除这条记录吗？删除后无法恢复。')) {
      return;
    }

    btn.disabled = true;

    try {
      await MindTraceStorage.deleteById(id);
      await loadAndRender();
    } catch (err) {
      console.error('[MindTrace Popup] 删除失败:', err);
      alert('删除失败，请稍后再试');
      btn.disabled = false;
    }
  }

  function renderCard(item) {
    const time = MindTraceUtils.formatDateShort(item.createdAt);
    const idEscaped = MindTraceUtils.escapeHtml(item.id);
    const note = item.note
      ? MindTraceUtils.escapeHtml(
          MindTraceUtils.truncate(item.note, 120)
        )
      : '<span class="card-note-empty">（未填写想法）</span>';
    const quote = MindTraceUtils.escapeHtml(
      MindTraceUtils.truncate(item.selectedText, 100)
    );
    const title = MindTraceUtils.escapeHtml(
      MindTraceUtils.truncate(item.pageTitle || '未知页面', 40)
    );
    const url = MindTraceUtils.escapeHtml(item.pageUrl || '#');

    return `
      <article class="card">
        <div class="card-head">
          <time class="card-time">${time}</time>
          <button
            type="button"
            class="btn-card-delete"
            data-delete-id="${idEscaped}"
            title="删除这条记录"
            aria-label="删除这条记录"
          >×</button>
        </div>
        <div class="card-note">${note}</div>
        <blockquote class="card-quote">${quote}</blockquote>
        <div class="card-source">
          <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>
        </div>
      </article>
    `;
  }

  /**
   * 导出 Markdown
   */
  async function onExportMarkdownClick() {
    if (!exportMdBtn) {
      return;
    }

    exportMdBtn.disabled = true;

    try {
      const items = await MindTraceStorage.getAll();

      if (!items.length) {
        alert('暂无灵感记录，无法导出');
        return;
      }

      const markdown = buildMarkdownDocument(items);
      const filename = buildExportFilename();
      downloadMarkdownFile(markdown, filename);
    } catch (err) {
      console.error('[MindTrace Popup] 导出失败:', err);
      alert('导出失败，请重试');
    } finally {
      exportMdBtn.disabled = false;
    }
  }

  function buildMarkdownDocument(items) {
    const blocks = items.map((item) => formatRecordAsMarkdown(item));
    return blocks.join('\n\n' + RECORD_SEPARATOR + '\n\n') + '\n';
  }

  function formatRecordAsMarkdown(record) {
    const title = getRecordTitle(record);
    const time = formatExportDateTime(record.createdAt);
    const pageTitle = (record.pageTitle || '未知页面').trim();
    const pageUrl = (record.pageUrl || '').trim();
    const selectedText = (record.selectedText || '').trim();
    const note = (record.note || '').trim();

    return [
      `# ${escapeMarkdownHeading(title)}`,
      '',
      `时间：${time}`,
      '',
      '来源页面：',
      pageTitle,
      '',
      '网页链接：',
      pageUrl || '（无）',
      '',
      '---',
      '',
      '## 原文',
      '',
      selectedText || '（无）',
      '',
      '---',
      '',
      '## 我的想法',
      '',
      note || '（无）',
    ].join('\n');
  }

  function getRecordTitle(record) {
    const note = (record.note || '').trim();
    const selected = (record.selectedText || '').trim();
    const source = note || selected || '无标题';
    return source.length <= 20 ? source : source.slice(0, 20);
  }

  function formatExportDateTime(timestamp) {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  function escapeMarkdownHeading(text) {
    return String(text).replace(/[\r\n]+/g, ' ').replace(/#/g, '\\#');
  }

  function buildExportFilename() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `MindTrace-${y}-${m}-${day}.md`;
  }

  function downloadMarkdownFile(content, filename) {
    const blob = new Blob([content], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
