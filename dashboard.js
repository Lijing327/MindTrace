/**
 * MindTrace — 思维花园（浅色阅读空间）
 */

(function () {
  'use strict';

  const PAGE_SIZE = 20;
  const COLLAPSE_THRESHOLD = 360;
  const MAX_EVIDENCE_DISPLAY = 3;
  const KEYWORD_SAMPLE_SIZE = 50;
  const KEYWORD_TOP_N = 3;
  const MIN_RECORDS_FOR_THEMES = 2;
  const RECORD_SEPARATOR = '==================================================';

  const STOPWORDS = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
    '好', '自己', '这', '那', '他', '她', '它', '我们', '他们', '什么', '怎么',
    '为什么', '可以', '这个', '那个', '已经', '因为', '所以', '如果', '但是',
    '或者', '以及', '还有', '就是', '而且', '只是', '可能', '应该', '需要',
    '觉得', '感觉', '知道', '认为', '关于', '对于', '进行', '通过', '使用',
    '问题', '方法', '方式', '东西', '情况', '时候', '现在', '之后', '之前',
    '然后', '其实', '真的', '非常', '比较', '更加', '一些', '一点', '这些',
    '那些', '还是', '只能', '作为', '成为', '开始', '结束', '想要', '希望',
    '喜欢', '正在', '将会', '能够', '不能', '不会', '不要', '没什么', '有点',
    '一下', '一种', '一样', '一直', '一定', '一起', '一条', '一个', '这种',
    '那样', '如何', '这样', '那里', '这里', '其中', '其他', '另外', '之间',
    '以来', '以后', '以内', '之外', '方面', '部分', '全部', '整个', '每个',
    '任何', '某个', '许多', '很多', '几个', '第一', '第二', '最后', '首先',
    '同时', '不过', '然而', '因此', '于是', '总之', '一般', '通常', '往往',
    '经常', '有时', '偶尔', '总是', '从来', '几乎', '大概', '大约', '左右',
    '里面', '外面', '上面', '下面', '中间', '旁边', '本身', '大家', '咱们',
    '自己', '别人', '人家', '哪些', '哪个', '多少', '多', '少', '大', '小',
    '新', '旧', '对', '错', '真', '假', '快', '慢', '早', '晚', '远', '近',
    '给', '让', '叫', '被', '把', '向', '从', '以', '于', '与', '及', '并',
    '且', '而', '则', '即', '便', '虽', '但', '却', '又', '再', '还', '更',
    '最', '太', '极', '挺', '怪', '蛮', '行', '成', '能', '会', '要', '得',
    '着', '过', '了', '呢', '吗', '吧', '啊', '呀', '哦', '嗯', '唉', '嘿',
  ]);

  const gardenRoomEl = document.querySelector('.garden-room');
  const todayContentEl = document.getElementById('today-content');
  const recallContentEl = document.getElementById('recall-content');
  const recallShuffleBtn = document.getElementById('recall-shuffle-btn');
  const searchInput = document.getElementById('search-input');
  const flowHintEl = document.getElementById('flow-hint');
  const timelineCountEl = document.getElementById('timeline-count');
  const timelineEl = document.getElementById('timeline');
  const loadSentinelEl = document.getElementById('load-sentinel');
  const loadStatusEl = document.getElementById('load-status');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const exportMdBtn = document.getElementById('export-md-btn');
  const embeddingStatusEl = document.getElementById('embedding-status');
  const evidenceLightboxEl = document.getElementById('evidence-lightbox');
  const evidenceLightboxImgEl = evidenceLightboxEl
    ? evidenceLightboxEl.querySelector('.evidence-lightbox-img')
    : null;
  const gardenListEl = document.getElementById('garden-list');
  const gardenCreateBtn = document.getElementById('garden-create-btn');
  const gardenDialogEl = document.getElementById('garden-dialog');
  const gardenDialogFormEl = document.getElementById('garden-dialog-form');
  const gardenDialogNameEl = document.getElementById('garden-dialog-name');
  const gardenDialogDescEl = document.getElementById('garden-dialog-desc');
  const gardenDialogCancelEl = document.getElementById('garden-dialog-cancel');
  const mastheadGardenNameEl = document.getElementById('masthead-garden-name');
  const mastheadGardenDescEl = document.getElementById('masthead-garden-desc');
  const cosmosLinkEl = document.getElementById('cosmos-link');
  const cognitionMirrorEl = document.getElementById('cognition-mirror');
  const cognitionMirrorListEl = document.getElementById('cognition-mirror-list');
  const cognitionMirrorBadgeEl = document.getElementById('cognition-mirror-badge');

  /** @type {Set<string>} */
  const imageObjectUrlCache = new Set();

  let insightRefreshToken = 0;

  /** @type {Garden[]} */
  let gardens = [];
  let currentGardenId = MindTraceGardenService.DEFAULT_GARDEN_ID;

  let allItems = [];
  let embeddingBackfillRunning = false;
  let filteredItems = [];
  let renderedCount = 0;
  let isLoadingMore = false;
  let currentRecallId = null;
  let editingItemId = null;
  let skipNextStorageReload = false;

  /**
   * 从思维宇宙跳转：dashboard.html?thought=<id>
   * @returns {string|null}
   */
  function getFocusThoughtIdFromUrl() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('thought');
    if (fromQuery) {
      return fromQuery;
    }
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash.startsWith('thought-')) {
      return hash.slice('thought-'.length);
    }
    return hash || null;
  }

  /**
   * 确保时间线已渲染到包含目标思考
   * @param {string} thoughtId
   * @returns {Promise<boolean>}
   */
  async function ensureThoughtRendered(thoughtId) {
    if (!thoughtId || !findItemById(thoughtId)) {
      return false;
    }

    if (searchInput.value.trim()) {
      searchInput.value = '';
      gardenRoomEl.classList.remove('is-searching');
      await refreshTimeline('');
    }

    const idx = filteredItems.findIndex((x) => x.id === thoughtId);
    if (idx === -1) {
      return false;
    }

    let guard = 0;
    while (renderedCount <= idx && renderedCount < filteredItems.length) {
      await loadMoreBatch();
      guard += 1;
      if (guard > 200) {
        break;
      }
    }

    return renderedCount > idx;
  }

  /**
   * 滚动并高亮时间线中的某条思考（来自思维宇宙）
   * @param {string} thoughtId
   */
  async function focusThoughtInTimeline(thoughtId) {
    const ok = await ensureThoughtRendered(thoughtId);
    if (!ok) {
      return;
    }

    const safeId =
      typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(thoughtId)
        : thoughtId.replace(/"/g, '\\"');
    const piece = timelineEl.querySelector(
      `.timeline-item[data-id="${safeId}"]`
    );
    if (!piece) {
      return;
    }

    document.querySelectorAll('.timeline-item.is-cosmos-focus').forEach((el) => {
      el.classList.remove('is-cosmos-focus');
    });
    piece.classList.add('is-cosmos-focus');

    const timelineSection = document.querySelector('.timeline-section');
    if (timelineSection) {
      timelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.setTimeout(() => {
      piece.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    window.setTimeout(() => {
      piece.classList.remove('is-cosmos-focus');
    }, 4500);
  }

  async function init() {
    await setupGardenSwitcher();

    const focusId = getFocusThoughtIdFromUrl();
    if (focusId) {
      try {
        const thought = await MindTraceStorage.getById(focusId);
        if (thought) {
          const gid = MindTraceGardenService.resolveGardenId(thought);
          if (gid !== currentGardenId) {
            currentGardenId = gid;
            await MindTraceGardenService.setCurrentGardenId(gid);
            renderGardenRail();
            updateGardenChrome();
          }
        }
      } catch (err) {
        console.warn('[MindTrace] focus thought garden resolve failed:', err);
      }
    }

    await reloadAllData();

    if (focusId) {
      await focusThoughtInTimeline(focusId);
    }

    searchInput.addEventListener(
      'input',
      MindTraceUtils.debounce(onSearchInput, 200)
    );

    if (recallShuffleBtn) {
      recallShuffleBtn.addEventListener('click', () => renderWhisper(allItems, true));
    }

    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', onExportMarkdownClick);
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => loadMoreBatch());
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') {
        return;
      }
      const gardenChanged =
        changes[MindTraceGardenService.STORAGE_KEY] ||
        changes[MindTraceGardenService.CURRENT_GARDEN_KEY];
      if (gardenChanged) {
        setupGardenSwitcher().then(() => reloadAllData(searchInput.value));
        return;
      }
      if (changes[MindTraceStorage.STORAGE_KEY]) {
        if (skipNextStorageReload) {
          skipNextStorageReload = false;
          return;
        }
        reloadAllData(searchInput.value);
      }
      if (changes[MindTraceInsightService.STORAGE_KEY]) {
        refreshCognitionMirrorFromCache();
      }
    });

    setupInfiniteScroll();
    setupEvidenceLightbox();
    setupCreatorConnect();
    setupEmbeddingStatus();
  }

  function setupCreatorConnect() {
    const footerInner = document.getElementById('garden-connect-inner');
    const footer = document.getElementById('garden-connect');
    const mastheadLink = document.getElementById('masthead-connect-link');

    if (
      typeof MindTraceCreator === 'undefined' ||
      !MindTraceCreator.enabled ||
      !footerInner
    ) {
      if (footer) {
        footer.hidden = true;
      }
      return;
    }

    const activeLinks = MindTraceCreator.getActiveLinks();
    if (!activeLinks.length) {
      if (footer) {
        footer.hidden = true;
      }
      return;
    }

    if (mastheadLink) {
      mastheadLink.hidden = false;
    }

    const headline = MindTraceUtils.escapeHtml(MindTraceCreator.headline || '');
    const subline = MindTraceUtils.escapeHtml(MindTraceCreator.subline || '');

    const linksHtml = activeLinks
      .map((link) => {
        const label = MindTraceUtils.escapeHtml(link.label || '联系');
        if (link.type === 'copy') {
          const value = MindTraceUtils.escapeHtml(link.value || '');
          const hint = MindTraceUtils.escapeHtml(link.hint || '已复制');
          return `<button type="button" class="connect-chip connect-chip--copy" data-copy="${value}" data-copy-hint="${hint}">${label}</button>`;
        }
        let href = (link.href || '').trim();
        if (link.type === 'mailto' && href && !/^mailto:/i.test(href)) {
          href = `mailto:${href.replace(/^mailto:/i, '')}`;
        }
        const hrefEsc = MindTraceUtils.escapeHtml(href || '#');
        const external =
          link.type === 'url'
            ? ' target="_blank" rel="noopener noreferrer"'
            : '';
        return `<a class="connect-chip" href="${hrefEsc}"${external}>${label}</a>`;
      })
      .join('');

    footerInner.innerHTML = `
      <p class="garden-connect-title">${headline}</p>
      ${subline ? `<p class="garden-connect-sub">${subline}</p>` : ''}
      <div class="garden-connect-links">${linksHtml}</div>
    `;

    footerInner.querySelectorAll('.connect-chip--copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        const hint = btn.getAttribute('data-copy-hint') || '已复制';
        try {
          await navigator.clipboard.writeText(text);
          showConnectToast(hint);
        } catch (_err) {
          showConnectToast(text);
        }
      });
    });
  }

  function showConnectToast(message) {
    let toast = document.getElementById('connect-toast');
    if (!toast) {
      toast = document.createElement('p');
      toast.id = 'connect-toast';
      toast.className = 'connect-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showConnectToast._timer);
    showConnectToast._timer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function setupEmbeddingStatus() {
    if (!embeddingStatusEl || typeof MindTraceEmbeddingService === 'undefined') {
      return;
    }

    MindTraceEmbeddingService.onStatusChange((next) => {
      if (next === 'loading') {
        embeddingStatusEl.hidden = false;
        embeddingStatusEl.textContent = '正在唤醒语义模型，首次可能稍慢…';
        embeddingStatusEl.classList.add('is-loading');
      } else if (next === 'ready') {
        embeddingStatusEl.classList.remove('is-loading');
        if (!embeddingBackfillRunning) {
          embeddingStatusEl.hidden = true;
        }
      } else if (next === 'error') {
        embeddingStatusEl.hidden = false;
        embeddingStatusEl.textContent = '语义模型暂不可用，将使用关键词关联';
        embeddingStatusEl.classList.remove('is-loading');
      }
    });
  }

  function setEmbeddingBackfillStatus(text) {
    if (!embeddingStatusEl) {
      return;
    }
    if (!text) {
      embeddingStatusEl.hidden = true;
      embeddingStatusEl.classList.remove('is-loading');
      return;
    }
    embeddingStatusEl.hidden = false;
    embeddingStatusEl.textContent = text;
    embeddingStatusEl.classList.add('is-loading');
  }

  async function runEmbeddingBackfill() {
    if (
      embeddingBackfillRunning ||
      typeof MindTraceEmbeddingService === 'undefined' ||
      !allItems.length
    ) {
      return;
    }

    const needs = allItems.filter((item) => {
      const text = MindTraceEmbeddingService.getTextForEmbedding(item);
      return text && (!item.embedding || !item.embedding.length);
    });

    if (!needs.length) {
      return;
    }

    embeddingBackfillRunning = true;
    setEmbeddingBackfillStatus('正在为历史思考建立语义索引…');

    try {
      await MindTraceEmbeddingService.backfillMissing(
        needs,
        (record) => {
          const idx = allItems.findIndex((x) => x.id === record.id);
          if (idx !== -1) {
            allItems[idx] = record;
          }
          refreshVisibleRelatedBlocks();
        }
      );
    } catch (err) {
      console.warn('[MindTrace] embedding backfill failed:', err);
    } finally {
      embeddingBackfillRunning = false;
      if (MindTraceEmbeddingService.getStatus() !== 'loading') {
        setEmbeddingBackfillStatus('');
      }
      scheduleCognitionMirrorRefresh();
    }
  }

  function refreshVisibleRelatedBlocks() {
    document.querySelectorAll('.timeline-item[data-id]').forEach((piece) => {
      const id = piece.dataset.id;
      const item = findItemById(id);
      if (!item) {
        return;
      }
      const card = piece.querySelector('.timeline-card');
      if (!card) {
        return;
      }
      const old = card.querySelector('.thought-related');
      const readWrap = card.querySelector('.timeline-card-read');
      const html = buildRelatedThoughtsHtml(item);
      if (old) {
        old.remove();
      }
      if (!html) {
        return;
      }
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const block = temp.firstElementChild;
      if (readWrap) {
        readWrap.appendChild(block);
      } else {
        card.appendChild(block);
      }
    });
  }

  async function setupGardenSwitcher() {
    await MindTraceGardenService.migrateIfNeeded();
    gardens = await MindTraceGardenService.getGardens();
    currentGardenId = await MindTraceGardenService.getCurrentGardenId();
    renderGardenRail();
    updateGardenChrome();
    bindGardenRailEvents();
  }

  function updateGardenChrome() {
    const garden = gardens.find((g) => g.id === currentGardenId);
    if (mastheadGardenNameEl && garden) {
      mastheadGardenNameEl.textContent = garden.name;
    }
    if (mastheadGardenDescEl) {
      const desc =
        (garden && garden.description) ||
        '一片慢慢生长的个人思考空间';
      mastheadGardenDescEl.textContent = desc;
    }
    if (cosmosLinkEl) {
      cosmosLinkEl.href = `graph.html?garden=${encodeURIComponent(currentGardenId)}`;
    }
    document.title = garden
      ? `MindTrace — ${garden.name}`
      : 'MindTrace — 思维花园';
  }

  /**
   * @param {Garden[]} list
   * @returns {Promise<Map<string, number>>}
   */
  async function countThoughtsPerGarden(list) {
    const all = await MindTraceStorage.getAllRaw();
    const counts = new Map();
    list.forEach((g) => counts.set(g.id, 0));
    all.forEach((item) => {
      const gid = MindTraceGardenService.resolveGardenId(item);
      counts.set(gid, (counts.get(gid) || 0) + 1);
    });
    return counts;
  }

  async function renderGardenRail() {
    if (!gardenListEl) {
      return;
    }
    const counts = await countThoughtsPerGarden(gardens);
    gardenListEl.innerHTML = gardens
      .map((g) => {
        const active = g.id === currentGardenId ? ' is-active' : '';
        const n = counts.get(g.id) || 0;
        const accent = g.color || '#6b8cce';
        return `
          <button
            type="button"
            class="garden-card${active}"
            role="option"
            aria-selected="${g.id === currentGardenId}"
            data-garden-id="${MindTraceUtils.escapeHtml(g.id)}"
            style="--garden-accent: ${MindTraceUtils.escapeHtml(accent)}"
          >
            <span class="garden-card-icon" aria-hidden="true">${MindTraceUtils.escapeHtml(g.icon || '🌿')}</span>
            <span class="garden-card-body">
              <span class="garden-card-name">${MindTraceUtils.escapeHtml(g.name)}</span>
              <span class="garden-card-meta">${n} 条思考</span>
            </span>
          </button>
        `;
      })
      .join('');
  }

  function bindGardenRailEvents() {
    if (!gardenListEl || gardenListEl.dataset.bound === '1') {
      return;
    }
    gardenListEl.dataset.bound = '1';
    gardenListEl.addEventListener('click', onGardenCardClick);

    if (gardenCreateBtn && gardenCreateBtn.dataset.bound !== '1') {
      gardenCreateBtn.dataset.bound = '1';
      gardenCreateBtn.addEventListener('click', openGardenCreateDialog);
    }
    if (gardenDialogCancelEl && gardenDialogCancelEl.dataset.bound !== '1') {
      gardenDialogCancelEl.dataset.bound = '1';
      gardenDialogCancelEl.addEventListener('click', () => {
        if (gardenDialogEl) {
          gardenDialogEl.close();
        }
      });
    }
    if (gardenDialogFormEl && gardenDialogFormEl.dataset.bound !== '1') {
      gardenDialogFormEl.dataset.bound = '1';
      gardenDialogFormEl.addEventListener('submit', onGardenDialogSubmit);
    }
  }

  function openGardenCreateDialog() {
    if (!gardenDialogEl) {
      return;
    }
    if (gardenDialogNameEl) {
      gardenDialogNameEl.value = '';
    }
    if (gardenDialogDescEl) {
      gardenDialogDescEl.value = '';
    }
    gardenDialogEl.showModal();
    if (gardenDialogNameEl) {
      gardenDialogNameEl.focus();
    }
  }

  async function onGardenDialogSubmit(event) {
    event.preventDefault();
    const name = (gardenDialogNameEl && gardenDialogNameEl.value.trim()) || '';
    if (!name) {
      return;
    }
    const description =
      (gardenDialogDescEl && gardenDialogDescEl.value.trim()) || '';
    try {
      const garden = await MindTraceGardenService.createGarden({
        name,
        description,
      });
      gardens = await MindTraceGardenService.getGardens();
      currentGardenId = garden.id;
      if (gardenDialogEl) {
        gardenDialogEl.close();
      }
      await switchToGarden(garden.id);
    } catch (err) {
      console.error('[MindTrace] 创建花园失败:', err);
      alert('创建花园失败，请稍后再试');
    }
  }

  async function onGardenCardClick(event) {
    const card = event.target.closest('[data-garden-id]');
    if (!card) {
      return;
    }
    const gardenId = card.getAttribute('data-garden-id');
    if (!gardenId || gardenId === currentGardenId) {
      return;
    }
    await switchToGarden(gardenId);
  }

  async function switchToGarden(gardenId) {
    currentGardenId = gardenId;
    await MindTraceGardenService.setCurrentGardenId(gardenId);
    renderGardenRail();
    updateGardenChrome();
    await reloadAllData(searchInput.value);
  }

  /**
   * @param {string} type
   * @returns {string}
   */
  function insightObserveClass(type) {
    switch (type) {
      case MindTraceInsightService.INSIGHT_TYPES.TOP_THEME:
        return 'cognition-observe--theme';
      case MindTraceInsightService.INSIGHT_TYPES.LONG_TERM:
        return 'cognition-observe--long-term';
      case MindTraceInsightService.INSIGHT_TYPES.EVOLUTION:
        return 'cognition-observe--evolution';
      case MindTraceInsightService.INSIGHT_TYPES.GARDEN_FOCUS:
        return 'cognition-observe--garden';
      default:
        return 'cognition-observe--theme';
    }
  }

  /**
   * @param {Insight[]} insights
   */
  function renderCognitionMirror(insights) {
    if (!cognitionMirrorEl || !cognitionMirrorListEl) {
      return;
    }

    const list = (insights || []).filter((i) => i && i.content);
    if (!list.length) {
      cognitionMirrorEl.hidden = true;
      cognitionMirrorListEl.innerHTML = '';
      return;
    }

    cognitionMirrorEl.hidden = false;
    cognitionMirrorListEl.innerHTML = list
      .map((insight) => {
        const cls = insightObserveClass(insight.type);
        const title = MindTraceUtils.escapeHtml(insight.title || '观察');
        const body = MindTraceUtils.escapeHtml(insight.content || '');
        return `
          <article class="cognition-observe ${cls}" data-insight-type="${MindTraceUtils.escapeHtml(insight.type || '')}">
            <h3 class="cognition-observe-title">${title}</h3>
            <p class="cognition-observe-body">${body}</p>
          </article>
        `;
      })
      .join('');
  }

  function setCognitionMirrorLoading(loading) {
    if (cognitionMirrorBadgeEl) {
      cognitionMirrorBadgeEl.hidden = !loading;
    }
  }

  async function refreshCognitionMirrorFromCache() {
    if (!cognitionMirrorListEl) {
      return;
    }
    try {
      const gardenInsights =
        await MindTraceInsightService.getCachedInsights(currentGardenId);
      let globalFocus = [];
      if (gardens.length > 1) {
        const globalAll = await MindTraceInsightService.getCachedInsights(null);
        globalFocus = globalAll.filter(
          (i) => i.type === MindTraceInsightService.INSIGHT_TYPES.GARDEN_FOCUS
        );
      }
      renderCognitionMirror([...gardenInsights, ...globalFocus]);
    } catch (err) {
      console.warn('[MindTrace] insight cache render failed:', err);
    }
  }

  async function loadCognitionMirror() {
    if (!cognitionMirrorListEl) {
      return;
    }

    const token = ++insightRefreshToken;
    await refreshCognitionMirrorFromCache();

    if (allItems.length < 2) {
      if (cognitionMirrorEl) {
        cognitionMirrorEl.hidden = true;
      }
      return;
    }

    setCognitionMirrorLoading(true);

    try {
      const gardenInsights = await MindTraceInsightService.getInsights(
        currentGardenId
      );
      let merged = [...gardenInsights];
      if (gardens.length > 1) {
        const globalAll = await MindTraceInsightService.getInsights(null);
        const focus = globalAll.filter(
          (i) => i.type === MindTraceInsightService.INSIGHT_TYPES.GARDEN_FOCUS
        );
        merged = [...gardenInsights, ...focus];
      }

      if (token === insightRefreshToken) {
        renderCognitionMirror(merged);
      }
    } catch (err) {
      console.warn('[MindTrace] insight load failed:', err);
    } finally {
      if (token === insightRefreshToken) {
        setCognitionMirrorLoading(false);
      }
    }
  }

  function scheduleCognitionMirrorRefresh() {
    if (typeof MindTraceInsightService === 'undefined') {
      return;
    }
    MindTraceInsightService.scheduleRegenerate(currentGardenId);
    if (gardens.length > 1) {
      MindTraceInsightService.scheduleRegenerate(null);
    }
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        loadCognitionMirror();
      }
    }, MindTraceInsightService.DEBOUNCE_MS + 120);
  }

  async function reloadAllData(query) {
    try {
      allItems = await MindTraceStorage.getAll(currentGardenId);
      renderTodayCard(allItems);
      renderWhisper(allItems);
      await refreshTimeline(query || '');
      loadCognitionMirror();
      runEmbeddingBackfill();
    } catch (err) {
      console.error('[MindTrace] 加载失败:', err);
      todayContentEl.innerHTML =
        '<p class="card-empty">暂时无法加载，请刷新页面</p>';
      timelineEl.innerHTML =
        '<p class="stream-empty">加载失败，请刷新后重试</p>';
    }
  }

  function onSearchInput() {
    const q = searchInput.value;
    gardenRoomEl.classList.toggle('is-searching', !!(q && q.trim()));
    refreshTimeline(q);
  }

  /* —— 今日思考 —— */

  function countTodayRecords(items) {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return items.filter(
      (item) => item.createdAt >= start && item.createdAt < end
    ).length;
  }

  function extractTopKeywords(items, topN) {
    const limit = topN || KEYWORD_TOP_N;
    const notes = items
      .slice(0, KEYWORD_SAMPLE_SIZE)
      .map((item) => (item.note || '').trim())
      .filter(Boolean);

    if (notes.length < MIN_RECORDS_FOR_THEMES) {
      return [];
    }

    const freq = new Map();
    notes.forEach((note) => {
      tokenizeForKeywords(note).forEach((token) => {
        if (token.length < 2 || STOPWORDS.has(token)) {
          return;
        }
        freq.set(token, (freq.get(token) || 0) + 1);
      });
    });

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  function tokenizeForKeywords(text) {
    const tokens = [];
    const chineseRe = /[\u4e00-\u9fa5]{2,4}/g;
    let match;
    while ((match = chineseRe.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    const english = text.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g);
    if (english) {
      english.forEach((w) => tokens.push(w.toLowerCase()));
    }
    return tokens;
  }

  function buildTagPills(keywords) {
    if (!keywords.length) {
      return '';
    }
    const pills = keywords
      .map((k) => `<span class="tag-pill">${MindTraceUtils.escapeHtml(k)}</span>`)
      .join('');
    return `
      <p class="tag-label">你最近频繁想到：</p>
      <div class="tag-row">${pills}</div>
    `;
  }

  function renderTodayCard(items) {
    const total = items.length;
    const todayCount = countTodayRecords(items);
    const keywords = extractTopKeywords(items);

    if (total === 0) {
      todayContentEl.innerHTML =
        '<p class="card-empty">开始记录你的第一条思考吧。在网页上划词即可。</p>';
      return;
    }

    const tagsHtml = buildTagPills(keywords);

    if (todayCount === 0) {
      todayContentEl.innerHTML = `
        <p class="today-lead">今天还没有新的思考片段</p>
        <p class="today-note">去浏览网页，划下触动你的那一句话</p>
        ${tagsHtml}
      `;
      return;
    }

    const countText =
      todayCount === 1 ? '1 个' : `${todayCount} 个`;

    todayContentEl.innerHTML = `
      <p class="today-lead">今天留下了 <strong>${countText}</strong>思考片段</p>
      ${tagsHtml}
    `;
  }

  /* —— 随机回顾 —— */

  function pickRandomRecord(items, avoidCurrent) {
    if (!items.length) {
      return undefined;
    }
    if (items.length === 1) {
      return items[0];
    }
    let pool = items;
    if (avoidCurrent && currentRecallId) {
      const filtered = items.filter((item) => item.id !== currentRecallId);
      if (filtered.length) {
        pool = filtered;
      }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return '刚刚';
    }
    if (minutes < 60) {
      return `${minutes} 分钟前`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} 小时前`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days} 天前`;
    }
    if (days < 30) {
      return `${Math.floor(days / 7)} 周前`;
    }
    if (days < 365) {
      return `${Math.floor(days / 30)} 个月前`;
    }
    return MindTraceUtils.formatDate(timestamp);
  }

  function getRecallText(record) {
    const text =
      (record.note || '').trim() || (record.selectedText || '').trim();
    if (!text) {
      return '（一条安静的记录）';
    }
    const max = 200;
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function renderWhisper(items, shuffle) {
    if (!items.length) {
      recallContentEl.innerHTML =
        '<p class="card-empty">记录更多思考后，会在这里随机浮现</p>';
      recallShuffleBtn.hidden = true;
      currentRecallId = null;
      return;
    }

    const record = pickRandomRecord(items, shuffle);
    if (!record) {
      return;
    }

    currentRecallId = record.id;
    recallShuffleBtn.hidden = false;

    const when = formatRelativeTime(record.createdAt);
    const quote = MindTraceUtils.escapeHtml(getRecallText(record));
    const sourceTitle = MindTraceUtils.escapeHtml(
      record.pageTitle || '未知页面'
    );
    const sourceUrl = MindTraceUtils.escapeHtml(record.pageUrl || '#');

    recallContentEl.innerHTML = `
      <blockquote class="recall-quote">${quote}</blockquote>
      <p class="recall-meta">
        ${when} · 来自 <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceTitle}</a>
      </p>
    `;
  }

  /* —— 思维时间线 —— */

  function cancelAllEdits() {
    document.querySelectorAll('.timeline-item.is-editing').forEach((piece) => {
      cancelEditMode(piece, false);
    });
    editingItemId = null;
  }

  async function refreshTimeline(query) {
    cancelAllEdits();
    revokeCachedImageUrls();
    try {
      filteredItems = await MindTraceStorage.search(
        query || '',
        currentGardenId
      );
      renderedCount = 0;
      timelineEl.innerHTML = '';
      await updateTimelineHeader(filteredItems.length, query);

      if (!filteredItems.length) {
        renderTimelineEmpty(query);
        setStreamStatus('');
        updateLoadMoreButton();
        return;
      }

      await loadMoreBatch();
    } catch (err) {
      console.error('[MindTrace] 时间线加载失败:', err);
      timelineEl.innerHTML =
        '<p class="stream-empty">加载失败，请刷新后重试</p>';
    }
  }

  async function updateTimelineHeader(shownCount, query) {
    const total = await MindTraceStorage.count(currentGardenId);
    const q = (query || '').trim();

    if (q) {
      flowHintEl.textContent =
        shownCount > 0
          ? `与「${q}」相关的思考`
          : '没有找到相关的思考';
      timelineCountEl.textContent =
        shownCount > 0 ? `${shownCount} 条相关` : '';
    } else {
      flowHintEl.textContent = '沿着时间，慢慢向下走';
      timelineCountEl.textContent = total > 0 ? `共 ${total} 条` : '';
    }
  }

  function renderTimelineEmpty(query) {
    const hasQuery = query && query.trim();
    timelineEl.innerHTML = `
      <p class="stream-empty">${
        hasQuery
          ? '没有找到相关的思考<br/>试试其他关键词'
          : '还没有思考留下痕迹<br/>在网页划词，让灵感落入花园'
      }</p>
    `;
  }

  function setupInfiniteScroll() {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          loadMoreBatch();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(loadSentinelEl);
  }

  async function loadMoreBatch() {
    if (isLoadingMore || renderedCount >= filteredItems.length) {
      if (renderedCount >= filteredItems.length && filteredItems.length > 0) {
        setStreamStatus('已加载全部');
      }
      updateLoadMoreButton();
      return;
    }

    isLoadingMore = true;
    setStreamStatus('加载中…', true);

    const batch = filteredItems.slice(
      renderedCount,
      renderedCount + PAGE_SIZE
    );

    const fragment = document.createDocumentFragment();
    batch.forEach((item, i) => {
      fragment.appendChild(createTimelineItem(item, renderedCount + i));
    });

    timelineEl.appendChild(fragment);
    renderedCount += batch.length;
    isLoadingMore = false;

    if (renderedCount >= filteredItems.length) {
      setStreamStatus(
        filteredItems.length > PAGE_SIZE ? '已加载全部' : ''
      );
    } else {
      setStreamStatus('');
    }

    updateLoadMoreButton();
  }

  function updateLoadMoreButton() {
    const hasMore =
      filteredItems.length > 0 && renderedCount < filteredItems.length;
    loadMoreBtn.hidden = !hasMore;
  }

  function setStreamStatus(text, loading) {
    loadStatusEl.textContent = text || '';
    loadStatusEl.classList.toggle('is-loading', !!loading);
  }

  function formatTimelineTime(timestamp) {
    const d = new Date(timestamp);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${mm}/${dd}`,
      week: weekdays[d.getDay()],
      clock: `${h}:${min}`,
    };
  }

  function splitThoughtContent(item) {
    const note = (item.note || '').trim();
    const selected = (item.selectedText || '').trim();

    if (note) {
      const lines = note.split('\n');
      const title = lines[0].trim();
      const noteRest = lines.slice(1).join('\n').trim();
      const bodyParts = [];
      if (noteRest) {
        bodyParts.push(noteRest);
      }
      if (selected && selected !== title && !note.includes(selected)) {
        bodyParts.push(selected);
      }
      return {
        title: title || '（未写下想法）',
        body: bodyParts.join('\n\n'),
      };
    }

    if (selected) {
      if (selected.length <= 72) {
        return { title: selected, body: '' };
      }
      return { title: selected.slice(0, 72) + '…', body: selected };
    }

    return { title: '（未写下想法）', body: '' };
  }

  function buildBodyHtml(body) {
    if (!body) {
      return '';
    }
    const escaped = MindTraceUtils.escapeHtml(body);
    if (body.length <= COLLAPSE_THRESHOLD) {
      return `<p class="thought-body">${escaped}</p>`;
    }
    const expandId = `body-${MindTraceUtils.generateId()}`;
    return `
      <p class="thought-body thought-body-collapsed" data-expand-target="${expandId}">${escaped}</p>
      <button type="button" class="thought-more" data-expand-id="${expandId}" data-expanded="false">继续阅读</button>
    `;
  }

  function getRelatedDisplayLabel(record) {
    const { title } = splitThoughtContent(record);
    const label = (title || '').trim();
    if (!label || label.startsWith('（')) {
      return '一条相关思考';
    }
    return label.length > 56 ? label.slice(0, 56) + '…' : label;
  }

  function buildRelatedThoughtsHtml(item) {
    const related = MindTraceRelationService.findRelatedThoughts(
      item,
      allItems
    );
    if (!related.length) {
      return '';
    }

    const listItems = related
      .map(({ record, score, semantic }) => {
        const label = MindTraceUtils.escapeHtml(
          getRelatedDisplayLabel(record)
        );
        const scoreHtml =
          semantic && typeof score === 'number'
            ? `<span class="thought-related-score">${Math.round(
                Math.min(1, Math.max(0, score)) * 100
              )}%</span>`
            : '';
        return `<li class="thought-related-item"><span class="thought-related-title">${label}</span>${scoreHtml}</li>`;
      })
      .join('');

    const hasSemantic = related.some((r) => r.semantic);

    return `
      <div class="thought-related" aria-label="相关思考">
        <p class="thought-related-label">${
          hasSemantic ? '🧠 与以下思考高度相关：' : '你似乎以前也想过：'
        }</p>
        <ul class="thought-related-list">${listItems}</ul>
      </div>
    `;
  }

  function revokeCachedImageUrls() {
    imageObjectUrlCache.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_e) {
        /* ignore */
      }
    });
    imageObjectUrlCache.clear();
  }

  function buildEvidenceShellHtml(item) {
    const ids = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    if (!ids.length) {
      return '';
    }
    const extra =
      ids.length > MAX_EVIDENCE_DISPLAY
        ? `<span class="thought-evidence-more">+${ids.length - MAX_EVIDENCE_DISPLAY}</span>`
        : '';
    return `<div class="thought-evidence" data-thought-id="${MindTraceUtils.escapeHtml(item.id)}" aria-label="思维证据">${extra}</div>`;
  }

  /**
   * @param {HTMLElement} container
   * @param {InspirationRecord} item
   */
  async function hydrateEvidenceThumbs(container, item) {
    if (!container || typeof MindTraceImageStorage === 'undefined') {
      return;
    }

    const ids = (item.images || []).slice(0, MAX_EVIDENCE_DISPLAY);
    if (!ids.length) {
      return;
    }

    await MindTraceImageStorage.migrateIfNeeded();
    const urlMap = await MindTraceImageStorage.getObjectUrlsBatch(ids);

    const moreEl = container.querySelector('.thought-evidence-more');
    container.innerHTML = '';
    if (moreEl) {
      container.appendChild(moreEl);
    }

    ids.forEach((imageId) => {
      const url = urlMap[imageId];
      if (!url) {
        return;
      }
      imageObjectUrlCache.add(url);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thought-evidence-thumb';
      btn.dataset.fullUrl = url;
      btn.setAttribute('aria-label', '放大查看思维证据');
      const img = document.createElement('img');
      img.src = url;
      img.alt = '思维证据';
      img.loading = 'lazy';
      btn.appendChild(img);
      container.insertBefore(btn, moreEl || null);
    });

    bindEvidenceThumbClicks(container);
  }

  function bindEvidenceThumbClicks(container) {
    container.querySelectorAll('.thought-evidence-thumb').forEach((btn) => {
      if (btn.dataset.bound === '1') {
        return;
      }
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const url = btn.dataset.fullUrl;
        if (url) {
          openEvidenceLightbox(url);
        }
      });
    });
  }

  function openEvidenceLightbox(url) {
    if (!evidenceLightboxEl || !evidenceLightboxImgEl) {
      window.open(url, '_blank');
      return;
    }
    evidenceLightboxImgEl.src = url;
    evidenceLightboxEl.hidden = false;
    evidenceLightboxEl.setAttribute('aria-hidden', 'false');
  }

  function closeEvidenceLightbox() {
    if (!evidenceLightboxEl || !evidenceLightboxImgEl) {
      return;
    }
    evidenceLightboxEl.hidden = true;
    evidenceLightboxEl.setAttribute('aria-hidden', 'true');
    evidenceLightboxImgEl.removeAttribute('src');
  }

  function setupEvidenceLightbox() {
    if (!evidenceLightboxEl) {
      return;
    }
    const closeBtn = evidenceLightboxEl.querySelector('.evidence-lightbox-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeEvidenceLightbox);
    }
    evidenceLightboxEl.addEventListener('click', (e) => {
      if (e.target === evidenceLightboxEl) {
        closeEvidenceLightbox();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && evidenceLightboxEl && !evidenceLightboxEl.hidden) {
        closeEvidenceLightbox();
      }
    });
  }

  function queueEvidenceHydrate(piece, item) {
    const shell = piece.querySelector('.thought-evidence');
    if (!shell) {
      return;
    }
    hydrateEvidenceThumbs(shell, item).catch((err) => {
      console.warn('[MindTrace] 思维证据加载失败:', err);
    });
  }

  function buildChipsHtml(pageUrl, pageTitle) {
    if (!pageUrl || pageUrl === '#') {
      return '';
    }
    const shortTitle = MindTraceUtils.escapeHtml(
      MindTraceUtils.truncate(pageTitle || '来源', 14)
    );
    const url = MindTraceUtils.escapeHtml(pageUrl);
    return `
      <div class="thought-chips">
        <a class="thought-chip" href="${url}" target="_blank" rel="noopener noreferrer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          查看来源
        </a>
        <span class="thought-chip thought-chip--static">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
          ${shortTitle}
        </span>
      </div>
    `;
  }

  function createTimelineItem(item, renderIndex) {
    const piece = document.createElement('article');
    piece.className = 'timeline-item';
    piece.dataset.id = item.id;
    piece.style.animationDelay = `${Math.min(renderIndex % 8, 7) * 0.04}s`;

    const t = formatTimelineTime(item.createdAt);
    const { title, body } = splitThoughtContent(item);
    const titleClass = title.startsWith('（')
      ? 'thought-title thought-title-empty'
      : 'thought-title';
    const titleHtml = `<h3 class="${titleClass}">${MindTraceUtils.escapeHtml(title)}</h3>`;
    const bodyHtml = buildBodyHtml(body);

    const pageTitle = item.pageTitle || '未知页面';
    const pageUrl = item.pageUrl || '#';
    const pageTitleEsc = MindTraceUtils.escapeHtml(pageTitle);
    const pageUrlEsc = MindTraceUtils.escapeHtml(pageUrl);
    const idEscaped = MindTraceUtils.escapeHtml(item.id);
    const chipsHtml = buildChipsHtml(pageUrl, pageTitle);
    const evidenceHtml = buildEvidenceShellHtml(item);
    const relatedHtml = buildRelatedThoughtsHtml(item);

    piece.innerHTML = `
      <div class="timeline-time">
        <span class="timeline-time-date">${t.date}</span>
        <span class="timeline-time-week">${t.week}</span>
        <span class="timeline-time-clock">${t.clock}</span>
      </div>
      <div class="timeline-axis"><span class="timeline-dot"></span></div>
      <div class="timeline-card">
        <div class="timeline-card-menu">
          <button type="button" class="btn-menu" aria-label="更多操作" aria-expanded="false">···</button>
          <div class="menu-dropdown">
            <button type="button" data-edit-id="${idEscaped}">编辑思考</button>
            <button type="button" data-remove-id="${idEscaped}">移除这条思考</button>
          </div>
        </div>
        ${titleHtml}
        ${bodyHtml}
        ${evidenceHtml}
        ${chipsHtml}
        <p class="thought-origin">来源：<a href="${pageUrlEsc}" target="_blank" rel="noopener noreferrer">${pageTitleEsc}</a></p>
        ${relatedHtml}
      </div>
    `;

    bindCardMenu(piece, item);
    bindExpandButtons(piece);
    queueEvidenceHydrate(piece, item);

    return piece;
  }

  function composeNoteFromFields(title, body) {
    const t = (title || '').trim();
    const b = (body || '').trim();
    if (!t && !b) {
      return '';
    }
    if (!b) {
      return t;
    }
    if (!t) {
      return b;
    }
    return t + '\n' + b;
  }

  function syncItemInMemory(updated) {
    const patch = (list) => {
      const idx = list.findIndex((x) => x.id === updated.id);
      if (idx !== -1) {
        list[idx] = updated;
      }
    };
    patch(allItems);
    patch(filteredItems);
  }

  function findItemById(id) {
    return (
      filteredItems.find((x) => x.id === id) ||
      allItems.find((x) => x.id === id)
    );
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function getReadContentNodes(card) {
    return card.querySelectorAll(
      '.thought-title, .thought-body, .thought-more, .thought-evidence, .thought-chips, .thought-origin, .thought-related'
    );
  }

  function buildReadContentHtml(item) {
    const { title, body } = splitThoughtContent(item);
    const titleClass = title.startsWith('（')
      ? 'thought-title thought-title-empty'
      : 'thought-title';
    const titleHtml = `<h3 class="${titleClass}">${MindTraceUtils.escapeHtml(title)}</h3>`;
    const bodyHtml = buildBodyHtml(body);
    const chipsHtml = buildChipsHtml(item.pageUrl, item.pageTitle);
    const pageTitleEsc = MindTraceUtils.escapeHtml(item.pageTitle || '未知页面');
    const pageUrlEsc = MindTraceUtils.escapeHtml(item.pageUrl || '#');
    const originHtml = `<p class="thought-origin">来源：<a href="${pageUrlEsc}" target="_blank" rel="noopener noreferrer">${pageTitleEsc}</a></p>`;
    const evidenceHtml = buildEvidenceShellHtml(item);
    const relatedHtml = buildRelatedThoughtsHtml(item);
    return titleHtml + bodyHtml + evidenceHtml + chipsHtml + originHtml + relatedHtml;
  }

  function refreshCardReadView(piece, item) {
    const card = piece.querySelector('.timeline-card');
    if (!card) {
      return;
    }
    const menu = card.querySelector('.timeline-card-menu');
    const editPanel = card.querySelector('.timeline-card-edit');
    const oldWrap = card.querySelector('.timeline-card-read');
    if (oldWrap) {
      oldWrap.remove();
    }
    const readNodes = getReadContentNodes(card);
    readNodes.forEach((el) => el.remove());

    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-card-read';
    wrapper.innerHTML = buildReadContentHtml(item);

    if (editPanel) {
      card.insertBefore(wrapper, editPanel);
    } else if (menu) {
      menu.insertAdjacentElement('afterend', wrapper);
    } else {
      card.appendChild(wrapper);
    }

    bindExpandButtons(piece);
    queueEvidenceHydrate(piece, item);
  }

  function enterEditMode(piece, item) {
    const card = piece.querySelector('.timeline-card');
    if (!card || editingItemId === item.id) {
      return;
    }

    if (editingItemId) {
      const other = document.querySelector(
        `.timeline-item[data-id="${editingItemId}"]`
      );
      if (other) {
        cancelEditMode(other, false);
      }
    }

    closeAllMenus();
    const { title, body } = splitThoughtContent(item);
    const readWrap = card.querySelector('.timeline-card-read');
    if (readWrap) {
      readWrap.hidden = true;
    } else {
      getReadContentNodes(card).forEach((el) => {
        el.hidden = true;
      });
    }

    const editPanel = document.createElement('div');
    editPanel.className = 'timeline-card-edit';
    editPanel.innerHTML = `
      <input
        type="text"
        class="thought-edit-title"
        value=""
        placeholder="标题或第一句想法"
        aria-label="思考标题"
      />
      <textarea
        class="thought-edit-body"
        rows="3"
        placeholder="继续写下你的想法…"
        aria-label="思考正文"
      ></textarea>
      <div class="timeline-card-edit-actions">
        <button type="button" class="btn-edit-save">保存修改</button>
        <button type="button" class="btn-edit-cancel">取消</button>
      </div>
    `;

    const titleInput = editPanel.querySelector('.thought-edit-title');
    const bodyTextarea = editPanel.querySelector('.thought-edit-body');
    titleInput.value = title.startsWith('（') ? '' : title;
    bodyTextarea.value = body;

    card.appendChild(editPanel);
    card.classList.add('is-editing');
    piece.classList.add('is-editing');
    editingItemId = item.id;

    autoResizeTextarea(bodyTextarea);
    bodyTextarea.addEventListener('input', () => autoResizeTextarea(bodyTextarea));

    editPanel.querySelector('.btn-edit-save').addEventListener('click', (e) => {
      e.stopPropagation();
      saveEditMode(piece, item.id);
    });
    editPanel.querySelector('.btn-edit-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      cancelEditMode(piece, true);
    });

    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditMode(piece, true);
      }
    });
    bodyTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditMode(piece, true);
      }
    });

    setTimeout(() => titleInput.focus(), 0);
  }

  function exitEditDom(piece) {
    const card = piece.querySelector('.timeline-card');
    if (!card) {
      return;
    }
    const editPanel = card.querySelector('.timeline-card-edit');
    if (editPanel) {
      editPanel.remove();
    }
    card.classList.remove('is-editing');
    piece.classList.remove('is-editing');

    const readWrap = card.querySelector('.timeline-card-read');
    if (readWrap) {
      readWrap.hidden = false;
    } else {
      getReadContentNodes(card).forEach((el) => {
        el.hidden = false;
      });
    }
    editingItemId = null;
  }

  function cancelEditMode(piece, restoreRead) {
    if (!piece) {
      editingItemId = null;
      return;
    }
    exitEditDom(piece);
    if (restoreRead) {
      const id = piece.dataset.id;
      const item = findItemById(id);
      if (item) {
        refreshCardReadView(piece, item);
      }
    }
  }

  async function saveEditMode(piece, id) {
    const card = piece.querySelector('.timeline-card');
    const editPanel = card && card.querySelector('.timeline-card-edit');
    if (!editPanel) {
      return;
    }

    const titleInput = editPanel.querySelector('.thought-edit-title');
    const bodyTextarea = editPanel.querySelector('.thought-edit-body');
    const saveBtn = editPanel.querySelector('.btn-edit-save');
    const titleVal = titleInput.value.trim();
    const bodyVal = bodyTextarea.value.trim();

    if (!titleVal && !bodyVal) {
      alert('请至少填写标题或正文');
      titleInput.focus();
      return;
    }

    const note = composeNoteFromFields(titleVal, bodyVal);
    saveBtn.disabled = true;

    try {
      skipNextStorageReload = true;
      const updated = await MindTraceStorage.updateById(id, { note });
      syncItemInMemory(updated);
      exitEditDom(piece);
      refreshCardReadView(piece, updated);
      if (typeof MindTraceEmbeddingService !== 'undefined') {
        MindTraceEmbeddingService.ensureRecordEmbedding(updated).then(() => {
          syncItemInMemory(updated);
          refreshCardReadView(piece, updated);
        });
      }
      renderTodayCard(allItems);
      if (currentRecallId === id) {
        renderWhisper(allItems, false);
      }
    } catch (err) {
      console.error('[MindTrace] 保存失败:', err);
      alert('保存失败，请稍后再试');
    } finally {
      saveBtn.disabled = false;
    }
  }

  function bindCardMenu(piece, item) {
    const menuBtn = piece.querySelector('.btn-menu');
    const dropdown = piece.querySelector('.menu-dropdown');
    const removeBtn = piece.querySelector('[data-remove-id]');
    const editBtn = piece.querySelector('[data-edit-id]');

    if (!menuBtn || !dropdown) {
      return;
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      const open = dropdown.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        const id = editBtn.getAttribute('data-edit-id');
        const record = findItemById(id) || item;
        if (record) {
          enterEditMode(piece, record);
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('is-open');
        if (editingItemId === piece.dataset.id) {
          cancelEditMode(piece, false);
        }
        onRemoveClick(e);
      });
    }
  }

  function closeAllMenus() {
    document.querySelectorAll('.menu-dropdown.is-open').forEach((el) => {
      el.classList.remove('is-open');
    });
    document.querySelectorAll('.btn-menu[aria-expanded="true"]').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  if (!window.__mindtraceMenuBound) {
    window.__mindtraceMenuBound = true;
    document.addEventListener('click', closeAllMenus);
  }

  function bindExpandButtons(piece) {
    piece.querySelectorAll('.thought-more').forEach((btn) => {
      btn.addEventListener('click', onExpandClick);
    });
  }

  function onExpandClick(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const targetId = btn.getAttribute('data-expand-id');
    const expanded = btn.getAttribute('data-expanded') === 'true';
    const card = btn.closest('.timeline-card');
    const el = card
      ? card.querySelector(`[data-expand-target="${targetId}"]`)
      : null;

    if (!el) {
      return;
    }

    if (expanded) {
      el.classList.add('thought-body-collapsed');
      btn.textContent = '继续阅读';
      btn.setAttribute('data-expanded', 'false');
    } else {
      el.classList.remove('thought-body-collapsed');
      btn.textContent = '收起';
      btn.setAttribute('data-expanded', 'true');
    }
  }
  async function onRemoveClick(event) {
    const id = event.currentTarget.getAttribute('data-remove-id');
    if (!id) {
      return;
    }

    if (!confirm('确定移除这条思考吗？移除后无法恢复。')) {
      return;
    }

    try {
      await MindTraceStorage.deleteById(id);
      await reloadAllData(searchInput.value);
    } catch (err) {
      console.error('[MindTrace] 移除失败:', err);
      alert('移除失败，请稍后再试');
    }
  }

  /* —— 导出 —— */

  async function onExportMarkdownClick() {
    if (!exportMdBtn) {
      return;
    }

    exportMdBtn.disabled = true;

    try {
      const items = await MindTraceStorage.getAll(currentGardenId);
      if (!items.length) {
        alert('当前花园还没有可导出的思考');
        return;
      }

      const garden = gardens.find((g) => g.id === currentGardenId);
      downloadMarkdownFile(
        buildMarkdownDocument(items, garden),
        buildExportFilename(garden)
      );
    } catch (err) {
      console.error('[MindTrace] 导出失败:', err);
      alert('导出失败，请稍后再试');
    } finally {
      exportMdBtn.disabled = false;
    }
  }

  function buildMarkdownDocument(items, garden) {
    const header = garden
      ? `# 认知花园：${escapeMarkdownHeading(garden.name)}\n\n`
      : '';
    const blocks = items.map((item) => formatRecordAsMarkdown(item));
    return header + blocks.join('\n\n' + RECORD_SEPARATOR + '\n\n') + '\n';
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

  function buildExportFilename(garden) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const slug = garden && garden.name
      ? String(garden.name).replace(/[\\/:*?"<>|]/g, '').slice(0, 16)
      : '';
    return slug
      ? `MindTrace-${slug}-${y}-${m}-${day}.md`
      : `MindTrace-${y}-${m}-${day}.md`;
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
