/**
 * MindTrace — 思维花园（浅色阅读空间）
 */

(function () {
  'use strict';

  function getDateLocale() {
    if (typeof MindTraceI18n !== 'undefined' && MindTraceI18n.getDateLocale) {
      return MindTraceI18n.getDateLocale();
    }
    if (typeof MindTraceUtils !== 'undefined' && MindTraceUtils.getDateLocale) {
      return MindTraceUtils.getDateLocale();
    }
    return 'zh-CN';
  }

  const WEEKDAY_KEYS = [
    'weekdaySun',
    'weekdayMon',
    'weekdayTue',
    'weekdayWed',
    'weekdayThu',
    'weekdayFri',
    'weekdaySat',
  ];

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

  const gardenRoomEl = document.querySelector('.page-content');
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
  const gardenDialogTitleEl = document.getElementById('garden-dialog-title');
  const gardenDialogNameEl = document.getElementById('garden-dialog-name');
  const gardenDialogDescEl = document.getElementById('garden-dialog-desc');
  const gardenDialogCancelEl = document.getElementById('garden-dialog-cancel');
  const gardenDialogSubmitEl = document.getElementById('garden-dialog-submit');
  const mastheadGardenNameEl = document.getElementById('masthead-garden-name');
  const mastheadGardenNameTextEl = document.getElementById(
    'masthead-garden-name-text'
  );
  const mastheadGardenEmojiEl = document.getElementById('masthead-garden-emoji');
  const mastheadGardenDescEl = document.getElementById('masthead-garden-desc');
  const cosmosLinkEl = document.getElementById('cosmos-link');
  const settingsOpenBtn = document.getElementById('settings-open-btn');
  const settingsDialogEl = document.getElementById('settings-dialog');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsDismissBtn = document.getElementById('settings-dismiss-btn');
  const todayNewBtn = document.getElementById('today-new-btn');
  const searchKbdEl = document.getElementById('search-kbd');
  const cognitionMirrorEl = document.getElementById('cognition-mirror');
  const cognitionMirrorListEl = document.getElementById('cognition-mirror-list');
  const cognitionMirrorBadgeEl = document.getElementById('cognition-mirror-badge');
  const pickupContentEl = document.getElementById('pickup-content');
  const tagCloudContentEl = document.getElementById('tag-cloud-content');
  const trajectoryWidgetEl = document.getElementById('trajectory-widget');
  const mastheadDateEl = document.getElementById('masthead-date');
  const thoughtDetailDialogEl = document.getElementById('thought-detail-dialog');
  const thoughtDetailBodyEl = document.getElementById('thought-detail-body');
  const thoughtDetailCloseEl = document.getElementById('thought-detail-close');
  const thoughtDetailDismissEl = document.getElementById('thought-detail-dismiss');

  /** @type {Set<string>} */
  const imageObjectUrlCache = new Set();
  /** @type {HTMLElement|null} */
  let evidenceLightboxLastTriggerEl = null;

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
  /** @type {'create'|'edit'} */
  let gardenDialogMode = 'create';
  let editingGardenId = '';
  let activeGardenMenuId = '';
  /** @type {'none'|'keyword'|'semantic'|'hybrid'} */
  let lastSearchMode = 'none';
  let searchInFlight = 0;

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

  function updateSearchKbdLabel() {
    if (!searchKbdEl) {
      return;
    }
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
    searchKbdEl.textContent = isMac ? '⌘ K' : 'Ctrl K';
  }

  function updateMastheadDate() {
    if (!mastheadDateEl) {
      return;
    }
    const now = new Date();
    const text = now.toLocaleDateString(getDateLocale(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    mastheadDateEl.textContent = text;
    mastheadDateEl.setAttribute('datetime', now.toISOString());
  }

  function setupSidebarNav() {
    const navItems = document.querySelectorAll('.nav-item[data-nav]');
    navItems.forEach((item) => {
      if (item.dataset.bound === '1') {
        return;
      }
      item.dataset.bound = '1';
      item.addEventListener('click', () => {
        navItems.forEach((el) => el.classList.remove('is-active'));
        item.classList.add('is-active');
      });
    });
  }

  function setupSettingsDialog() {
    const open = () => {
      if (settingsDialogEl && typeof settingsDialogEl.showModal === 'function') {
        settingsDialogEl.showModal();
      }
    };
    const close = () => {
      if (settingsDialogEl) {
        settingsDialogEl.close();
      }
    };
    if (settingsOpenBtn && settingsOpenBtn.dataset.bound !== '1') {
      settingsOpenBtn.dataset.bound = '1';
      settingsOpenBtn.addEventListener('click', open);
    }
    if (settingsCloseBtn && settingsCloseBtn.dataset.bound !== '1') {
      settingsCloseBtn.dataset.bound = '1';
      settingsCloseBtn.addEventListener('click', close);
    }
    if (settingsDismissBtn && settingsDismissBtn.dataset.bound !== '1') {
      settingsDismissBtn.dataset.bound = '1';
      settingsDismissBtn.addEventListener('click', close);
    }
  }

  async function init() {
    if (typeof MindTraceI18n !== 'undefined') {
      MindTraceI18n.applyPageI18n(document);
    }
    if (evidenceLightboxImgEl) {
      evidenceLightboxImgEl.alt = getText('evidenceImageAlt');
    }
    updateSearchKbdLabel();
    updateMastheadDate();
    setupSidebarNav();
    setupSettingsDialog();
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
      MindTraceUtils.debounce(onSearchInput, 380)
    );

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    if (recallShuffleBtn) {
      recallShuffleBtn.addEventListener('click', () => renderWhisper(allItems, true));
    }

    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', onExportMarkdownClick);
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => loadMoreBatch());
    }

    if (todayNewBtn) {
      todayNewBtn.addEventListener('click', () => {
        alert(getText('newRecordHint'));
      });
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
    setupThoughtDetailDialog();
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
      mastheadLink.textContent = getText('contactAuthor');
    }

    const headline = MindTraceUtils.escapeHtml(MindTraceCreator.headline || '');
    const subline = MindTraceUtils.escapeHtml(MindTraceCreator.subline || '');

    const linksHtml = activeLinks
      .map((link) => {
        const label = MindTraceUtils.escapeHtml(link.label || getText('contact'));
        if (link.type === 'copy') {
          const value = MindTraceUtils.escapeHtml(link.value || '');
          const hint = MindTraceUtils.escapeHtml(link.hint || getText('copied'));
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
        const hint = btn.getAttribute('data-copy-hint') || getText('copied');
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
        embeddingStatusEl.textContent = getText('embeddingLoading');
        embeddingStatusEl.classList.add('is-loading');
      } else if (next === 'ready') {
        embeddingStatusEl.classList.remove('is-loading');
        if (!embeddingBackfillRunning) {
          embeddingStatusEl.hidden = true;
        }
      } else if (next === 'error') {
        embeddingStatusEl.hidden = false;
        embeddingStatusEl.textContent = getText('embeddingError');
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
    setEmbeddingBackfillStatus(getText('embeddingBackfill'));

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
    if (mastheadGardenEmojiEl) {
      mastheadGardenEmojiEl.textContent = '🌿';
    }
    if (mastheadGardenNameTextEl) {
      mastheadGardenNameTextEl.textContent = getText('mindGarden');
    }
    if (mastheadGardenDescEl) {
      mastheadGardenDescEl.textContent =
        (garden && garden.description) ||
        getText('gardenDesc');
    }
    if (cosmosLinkEl) {
      cosmosLinkEl.href = `graph.html?garden=${encodeURIComponent(currentGardenId)}`;
    }
    document.title = garden
      ? `MindTrace — ${garden.name}`
      : getText('pageTitleDefault');
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
          <div
            class="garden-card${active}"
            role="option"
            tabindex="0"
            aria-selected="${g.id === currentGardenId}"
            data-garden-id="${MindTraceUtils.escapeHtml(g.id)}"
            style="--garden-accent: ${MindTraceUtils.escapeHtml(accent)}"
          >
            <span class="garden-card-icon" aria-hidden="true">${MindTraceUtils.escapeHtml(g.icon || '🌿')}</span>
            <span class="garden-card-body">
              <span class="garden-card-name">${MindTraceUtils.escapeHtml(g.name)}</span>
              <span class="garden-card-meta">${getText('thoughtCount', [n])}</span>
            </span>
            <span class="garden-card-actions">
              <button
                type="button"
                class="garden-card-action"
                data-garden-action="toggle-menu"
                data-garden-id="${MindTraceUtils.escapeHtml(g.id)}"
                aria-haspopup="menu"
                aria-expanded="${activeGardenMenuId === g.id ? 'true' : 'false'}"
                title="${MindTraceUtils.escapeHtml(getText('gardenActions'))}"
              >⋯</button>
              <div
                class="garden-card-menu${activeGardenMenuId === g.id ? ' is-open' : ''}"
                role="menu"
                data-garden-menu="${MindTraceUtils.escapeHtml(g.id)}"
              >
                <button type="button" role="menuitem" data-garden-action="edit" data-garden-id="${MindTraceUtils.escapeHtml(g.id)}">${MindTraceUtils.escapeHtml(getText('editGarden'))}</button>
                ${
                  g.id === MindTraceGardenService.DEFAULT_GARDEN_ID
                    ? ''
                    : `<button type="button" role="menuitem" class="is-danger" data-garden-action="delete" data-garden-id="${MindTraceUtils.escapeHtml(g.id)}">${MindTraceUtils.escapeHtml(getText('deleteGarden'))}</button>`
                }
              </div>
            </span>
          </div>
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
    gardenListEl.addEventListener('keydown', onGardenCardKeydown);
    document.addEventListener('click', onGardenMenuOutsideClick);
    document.addEventListener('keydown', onGardenMenuKeydown);

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
    gardenDialogMode = 'create';
    editingGardenId = '';
    if (gardenDialogTitleEl) {
      gardenDialogTitleEl.textContent = getText('createGardenTitle');
    }
    if (gardenDialogSubmitEl) {
      gardenDialogSubmitEl.textContent = getText('create');
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
      let garden = null;
      if (gardenDialogMode === 'edit' && editingGardenId) {
        garden = await MindTraceGardenService.updateGarden(editingGardenId, {
          name,
          description,
        });
      } else {
        garden = await MindTraceGardenService.createGarden({
          name,
          description,
        });
      }
      gardens = await MindTraceGardenService.getGardens();
      currentGardenId = garden.id;
      if (gardenDialogEl) {
        gardenDialogEl.close();
      }
      await switchToGarden(garden.id);
    } catch (err) {
      console.error('[MindTrace] 花园保存失败:', err);
      alert(getText('gardenSaveFailed'));
    }
  }

  async function onGardenCardClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const card = target.closest('[data-garden-id]');
    if (!card) {
      return;
    }
    const gardenId = card.getAttribute('data-garden-id');
    if (!gardenId) {
      return;
    }
    const actionEl = target.closest('[data-garden-action]');
    if (actionEl) {
      const action = actionEl.getAttribute('data-garden-action');
      if (action === 'toggle-menu') {
        event.preventDefault();
        event.stopPropagation();
        activeGardenMenuId = activeGardenMenuId === gardenId ? '' : gardenId;
        await renderGardenRail();
        return;
      }
      if (action === 'edit') {
        event.preventDefault();
        event.stopPropagation();
        activeGardenMenuId = '';
        openGardenEditDialog(gardens.find((g) => g.id === gardenId));
        return;
      }
      if (action === 'delete') {
        event.preventDefault();
        event.stopPropagation();
        activeGardenMenuId = '';
        await deleteGarden(gardens.find((g) => g.id === gardenId));
      }
      return;
    }
    activeGardenMenuId = '';
    if (gardenId === currentGardenId) {
      return;
    }
    await switchToGarden(gardenId);
  }

  function onGardenCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const card = target.closest('.garden-card[data-garden-id]');
    if (!card) {
      return;
    }
    event.preventDefault();
    card.click();
  }

  function openGardenEditDialog(garden) {
    if (!gardenDialogEl || !garden) {
      return;
    }
    gardenDialogMode = 'edit';
    editingGardenId = garden.id;
    if (gardenDialogTitleEl) {
      gardenDialogTitleEl.textContent = getText('editGarden');
    }
    if (gardenDialogSubmitEl) {
      gardenDialogSubmitEl.textContent = getText('save');
    }
    if (gardenDialogNameEl) {
      gardenDialogNameEl.value = garden.name || '';
    }
    if (gardenDialogDescEl) {
      gardenDialogDescEl.value = garden.description || '';
    }
    gardenDialogEl.showModal();
    if (gardenDialogNameEl) {
      gardenDialogNameEl.focus();
      gardenDialogNameEl.select();
    }
  }

  async function deleteGarden(garden) {
    if (!garden) {
      return;
    }
    const ok = window.confirm(
      getText('deleteGardenConfirm', [garden.name])
    );
    if (!ok) {
      return;
    }
    try {
      await MindTraceGardenService.deleteGarden(garden.id);
      gardens = await MindTraceGardenService.getGardens();
      const nextId = await MindTraceGardenService.getCurrentGardenId();
      await switchToGarden(nextId);
    } catch (err) {
      console.error('[MindTrace] 删除花园失败:', err);
      alert(getText('deleteGardenFailed'));
    }
  }

  function onGardenMenuOutsideClick(event) {
    if (!activeGardenMenuId) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    if (target.closest('.garden-card-actions')) {
      return;
    }
    activeGardenMenuId = '';
    renderGardenRail();
  }

  function onGardenMenuKeydown(event) {
    if (event.key !== 'Escape' || !activeGardenMenuId) {
      return;
    }
    activeGardenMenuId = '';
    renderGardenRail();
  }

  async function switchToGarden(gardenId) {
    currentGardenId = gardenId;
    await MindTraceGardenService.setCurrentGardenId(gardenId);
    renderGardenRail();
    updateGardenChrome();
    await reloadAllData(searchInput.value);
  }

  const OBSERVE_SLOTS = [
    {
      key: 'theme',
      labelKey: 'observeTheme',
      type: 'top-theme',
      tone: 'purple',
      icon: '🧠',
    },
    {
      key: 'time',
      labelKey: 'observeTimeSlot',
      type: null,
      tone: 'orange',
      icon: '💡',
    },
    {
      key: 'focus',
      labelKey: 'observeFocus',
      type: 'long-term-interest',
      tone: 'pink',
      icon: '🎯',
    },
    {
      key: 'trend',
      labelKey: 'observeTrend',
      type: 'cognitive-evolution',
      tone: 'green',
      icon: '🌱',
    },
  ];

  /**
   * @param {string} content
   * @returns {{ value: string, hint: string }}
   */
  function splitInsightContent(content) {
    const raw = (content || '').trim();
    if (!raw) {
      return { value: getText('insightEmptyValue'), hint: getText('insightEmptyHint') };
    }
    const parts = raw.split(/[·•\n]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { value: parts[0], hint: parts.slice(1).join(' · ') };
    }
    if (raw.length > 36) {
      return { value: raw.slice(0, 36), hint: raw.slice(36) };
    }
    return { value: raw, hint: '' };
  }

  /**
   * @param {InspirationRecord[]} items
   * @returns {{ value: string, hint: string }}
   */
  function computeThinkingTimeSlot(items) {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const hours = new Array(24).fill(0);
    (items || []).forEach((it) => {
      if (!it.createdAt || now - it.createdAt > weekMs) {
        return;
      }
      hours[new Date(it.createdAt).getHours()] += 1;
    });
    let peak = 0;
    let peakH = 0;
    hours.forEach((c, h) => {
      if (c > peak) {
        peak = c;
        peakH = h;
      }
    });
    if (!peak) {
      return { value: getText('insightEmptyValue'), hint: getText('thinkingTimeEmptyHint') };
    }
    const end = (peakH + 2) % 24;
    return {
      value: getText('thinkingTimeRange', [peakH, end]),
      hint: getText('thinkingTimeActiveHint'),
    };
  }

  /**
   * @param {Insight[]} insights
   * @param {InspirationRecord[]} items
   */
  function renderCognitionMirror(insights, items) {
    if (!cognitionMirrorListEl) {
      return;
    }

    const byType = new Map();
    (insights || []).forEach((ins) => {
      if (ins && ins.type && ins.content) {
        byType.set(ins.type, ins);
      }
    });

    const timeSlot = computeThinkingTimeSlot(items || allItems);

    cognitionMirrorListEl.innerHTML = OBSERVE_SLOTS.map((slot) => {
      let value = getText('insightEmptyValue');
      let hint = getText('insightEmptyHint');

      if (slot.key === 'time') {
        value = timeSlot.value;
        hint = timeSlot.hint;
      } else {
        const ins = slot.type ? byType.get(slot.type) : null;
        if (ins) {
          const split = splitInsightContent(ins.content);
          value = split.value;
          hint = split.hint || ins.title || hint;
        }
      }

      return `
        <article class="observe-stat-card observe-stat-card--${slot.tone}">
          <span class="observe-stat-icon" aria-hidden="true">${slot.icon}</span>
          <h3 class="observe-stat-label">${MindTraceUtils.escapeHtml(getText(slot.labelKey))}</h3>
          <p class="observe-stat-value">${MindTraceUtils.escapeHtml(value)}</p>
          <p class="observe-stat-hint">${MindTraceUtils.escapeHtml(hint)}</p>
        </article>
      `;
    }).join('');

    if (cognitionMirrorEl) {
      cognitionMirrorEl.hidden = false;
    }

    let summaryEl = cognitionMirrorEl
      ? cognitionMirrorEl.querySelector('.cognitive-growth-summary')
      : null;
    if (
      typeof MindTraceCognitiveService !== 'undefined' &&
      cognitionMirrorEl
    ) {
      const insights = MindTraceCognitiveService.buildInsights(
        items || allItems,
        currentGardenId
      );
      if (!summaryEl) {
        summaryEl = document.createElement('p');
        summaryEl.className = 'panel-desc cognitive-growth-summary';
        cognitionMirrorListEl.insertAdjacentElement('afterend', summaryEl);
      }
      summaryEl.textContent = insights.summary || '';
    } else if (summaryEl) {
      summaryEl.remove();
    }
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
      renderCognitionMirror([...gardenInsights, ...globalFocus], allItems);
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
      renderCognitionMirror([], allItems);
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
        renderCognitionMirror(merged, allItems);
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
      await renderTodayCard(allItems);
      renderPickupList(allItems);
      renderTagCloud(allItems);
      renderTrajectoryWidget(allItems);
      renderWhisper(allItems);
      await refreshTimeline(query || '');
      loadCognitionMirror();
      runEmbeddingBackfill();
    } catch (err) {
      console.error('[MindTrace] 加载失败:', err);
      todayContentEl.innerHTML =
        `<p class="card-empty">${MindTraceUtils.escapeHtml(getText('loadFailedRefresh'))}</p>`;
      timelineEl.innerHTML =
        `<p class="stream-empty">${MindTraceUtils.escapeHtml(getText('timelineLoadFailed'))}</p>`;
    }
  }

  function onSearchInput() {
    const q = searchInput.value;
    gardenRoomEl.classList.toggle('is-searching', !!(q && q.trim()));
    refreshTimeline(q);
  }

  /**
   * @param {'none'|'keyword'|'semantic'|'hybrid'} mode
   * @param {string} query
   * @returns {string}
   */
  function searchModeHint(mode, query) {
    const q = (query || '').trim();
    if (!q) {
      return '';
    }
    if (mode === 'semantic') {
      return getText('searchSemantic');
    }
    if (mode === 'hybrid') {
      return getText('searchHybrid');
    }
    return '';
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
      <p class="tag-label">${MindTraceUtils.escapeHtml(getText('recentKeywordsLabel'))}</p>
      <div class="tag-row">${pills}</div>
    `;
  }

  function countWeekRecords(items) {
    const start = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => (item.createdAt || 0) >= start).length;
  }

  /**
   * @param {InspirationRecord[]} items
   * @returns {number}
   */
  function computeRecordStreak(items) {
    const daySet = new Set();
    (items || []).forEach((item) => {
      const d = new Date(item.createdAt || 0);
      daySet.add(
        `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      );
    });
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 400; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) {
        streak += 1;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  /**
   * @param {InspirationRecord[]} items
   * @returns {Array<{ word: string, count: number }>}
   */
  function aggregateTagCounts(items) {
    const freq = new Map();
    (items || []).forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const t = String(tag).trim();
        if (t) {
          freq.set(t, (freq.get(t) || 0) + 1);
        }
      });
      const text = [item.note, item.selectedText].filter(Boolean).join('\n');
      tokenizeForKeywords(text).forEach((tok) => {
        if (tok.length < 2 || STOPWORDS.has(tok)) {
          return;
        }
        if (!freq.has(tok)) {
          freq.set(tok, (freq.get(tok) || 0) + 1);
        }
      });
      (item.keywords || []).forEach((kw) => {
        if (kw && !STOPWORDS.has(kw) && !freq.has(kw)) {
          freq.set(kw, (freq.get(kw) || 0) + 1);
        }
      });
    });
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, count]) => ({ word, count }));
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function getRecordPreviewLabel(record) {
    const note = (record.note || '').trim().split('\n')[0];
    if (note) {
      return note.length > 64 ? note.slice(0, 64) + '…' : note;
    }
    const sel = (record.selectedText || '').trim();
    if (sel) {
      return sel.length > 64 ? sel.slice(0, 64) + '…' : sel;
    }
    return record.pageTitle || getText('unnamedThought');
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function getRecordTag(record) {
    const tags = record.tags || [];
    if (tags.length) {
      return tags[0];
    }
    const kws = record.keywords || [];
    if (kws.length) {
      return kws[0];
    }
    const tokens = tokenizeForKeywords(
      [record.note, record.selectedText].filter(Boolean).join('\n')
    );
    return tokens[0] || getText('thought');
  }

  function renderPickupList(items) {
    if (!pickupContentEl) {
      return;
    }
    const recent = (items || []).slice(0, 3);
    if (!recent.length) {
      pickupContentEl.innerHTML =
        `<p class="card-empty">${MindTraceUtils.escapeHtml(getText('pickupEmpty'))}</p>`;
      return;
    }
    pickupContentEl.innerHTML = `
      <ul class="pickup-list">
        ${recent
          .map((item) => {
            const d = new Date(item.createdAt);
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return `
              <li class="pickup-item" data-thought-id="${MindTraceUtils.escapeHtml(item.id)}" tabindex="0" role="button">
                <span class="pickup-bullet" aria-hidden="true"></span>
                <div class="pickup-item-main">
                  <p class="pickup-date">${MindTraceUtils.escapeHtml(date)}</p>
                  <p class="pickup-text">${MindTraceUtils.escapeHtml(getRecordPreviewLabel(item))}</p>
                </div>
                <span class="pickup-tag">${MindTraceUtils.escapeHtml(getRecordTag(item))}</span>
              </li>
            `;
          })
          .join('')}
      </ul>
    `;
    pickupContentEl.querySelectorAll('.pickup-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-thought-id');
        if (id) {
          focusThoughtInTimeline(id);
        }
      });
    });
  }

  function renderTagCloud(items) {
    if (!tagCloudContentEl) {
      return;
    }
    const tags = aggregateTagCounts(items);
    const tagHtml = tags.length
      ? `<div class="tag-cloud-grid">
        ${tags
          .map(
            ({ word, count }) =>
              `<button type="button" class="tag-cloud-pill" data-tag-filter="${MindTraceUtils.escapeHtml(word)}">${MindTraceUtils.escapeHtml(word)} <strong>${count}</strong></button>`
          )
          .join('')}
      </div>`
      : `<p class="card-empty">${MindTraceUtils.escapeHtml(getText('tagCloudEmpty'))}</p>`;

    let sourcesHtml = '';
    if (typeof MindTraceSourceService !== 'undefined') {
      const groups = MindTraceSourceService.buildSourceGroups(
        items,
        currentGardenId
      ).slice(0, 6);
      sourcesHtml = groups.length
        ? `<div class="reading-sources-block">
            <p class="tag-label">${MindTraceUtils.escapeHtml(getText('readingSources'))}</p>
            <ul class="reading-sources-list">
              ${groups
                .map(
                  (g) => `
                <li>
                  <button type="button" class="reading-source-item" data-source-filter="${MindTraceUtils.escapeHtml(g.title)}">
                    <span class="reading-source-title">${MindTraceUtils.escapeHtml(g.title)}</span>
                    <span class="reading-source-count">${MindTraceUtils.escapeHtml(getText('thoughtCount', [g.count]))}</span>
                  </button>
                </li>`
                )
                .join('')}
            </ul>
          </div>`
        : '';
    }

    tagCloudContentEl.innerHTML = tagHtml + sourcesHtml;

    tagCloudContentEl.querySelectorAll('[data-tag-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag-filter');
        if (tag && searchInput) {
          searchInput.value = tag;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
    tagCloudContentEl.querySelectorAll('[data-source-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-source-filter');
        if (title && searchInput) {
          searchInput.value = title;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
  }

  /**
   * @param {InspirationRecord[]} items
   */
  function renderTrajectoryWidget(items) {
    if (!trajectoryWidgetEl) {
      return;
    }
    const total = items.length;
    const streak = computeRecordStreak(items);
    const themes = extractTopKeywords(items, 3);
    const themeText = themes.length ? themes.join(' · ') : '—';

    const days = 14;
    const counts = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000;
      const n = items.filter(
        (it) => it.createdAt >= start && it.createdAt < end
      ).length;
      counts.push(n);
    }
    const max = Math.max(1, ...counts);
    const w = 200;
    const h = 40;
    const step = w / Math.max(1, counts.length - 1);
    const points = counts
      .map((c, i) => {
        const x = i * step;
        const y = h - (c / max) * (h - 6) - 3;
        return `${x},${y}`;
      })
      .join(' ');

    trajectoryWidgetEl.innerHTML = `
      <div class="trajectory-card-head">
        <p class="trajectory-card-title">${MindTraceUtils.escapeHtml(getText('trajectoryTitle'))}</p>
        <span class="trajectory-card-icon" aria-hidden="true">📈</span>
      </div>
      <svg class="trajectory-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="url(#trajGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
        <defs>
          <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#b7791f"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="trajectory-stats">
        <div class="trajectory-stat"><span>${MindTraceUtils.escapeHtml(getText('totalRecords'))}</span><strong>${total}</strong></div>
        <div class="trajectory-stat"><span>${MindTraceUtils.escapeHtml(getText('streakRecords'))}</span><strong>${MindTraceUtils.escapeHtml(getText('streakDaysValue', [streak]))}</strong></div>
      </div>
      <p class="trajectory-themes-label">${MindTraceUtils.escapeHtml(getText('topThemesLabel'))}</p>
      <p class="trajectory-themes">${MindTraceUtils.escapeHtml(themeText)}</p>
      <a href="#timeline-section" class="trajectory-link">
        <span>${MindTraceUtils.escapeHtml(getText('viewFullStats'))}</span><span aria-hidden="true">→</span>
      </a>
    `;
  }

  async function renderTodayCard(items) {
    if (!todayContentEl) {
      return;
    }
    const total = items.length;
    const todayCount = countTodayRecords(items);
    const weekCount = countWeekRecords(items);
    const streak = computeRecordStreak(items);

    const metricsHtml = `
      <div class="today-metrics">
        <div class="today-metric">
          <span class="today-metric-value">${todayCount}</span>
          <span class="today-metric-label">${MindTraceUtils.escapeHtml(getText('todayRecords'))}</span>
        </div>
        <div class="today-metric">
          <span class="today-metric-value">${weekCount}</span>
          <span class="today-metric-label">${MindTraceUtils.escapeHtml(getText('last7Days'))}</span>
        </div>
        <div class="today-metric">
          <span class="today-metric-value">${streak}</span>
          <span class="today-metric-label">${MindTraceUtils.escapeHtml(getText('streakDaysLabel'))}</span>
        </div>
      </div>
    `;

    const statusText =
      todayCount > 0
        ? getText('thoughtsCapturedToday', [String(todayCount)])
        : getText('todayStatusGrowing');

    todayContentEl.innerHTML = `
      ${metricsHtml}
      <div class="today-status">
        <p class="today-status-icon" aria-hidden="true">🌱</p>
        <p class="today-status-text">${MindTraceUtils.escapeHtml(statusText)}</p>
      </div>
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
      return getText('justNow');
    }
    if (minutes < 60) {
      return getText('minutesAgo', [minutes]);
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return getText('hoursAgo', [hours]);
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return getText('daysAgo', [days]);
    }
    if (days < 30) {
      return getText('weeksAgo', [Math.floor(days / 7)]);
    }
    if (days < 365) {
      return getText('monthsAgo', [Math.floor(days / 30)]);
    }
    return MindTraceUtils.formatDate(timestamp);
  }

  function getRecallText(record) {
    const text =
      (record.note || '').trim() || (record.selectedText || '').trim();
    if (!text) {
      return getText('quietRecord');
    }
    const max = 200;
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function renderWhisper(items, shuffle) {
    if (!items.length) {
      recallContentEl.innerHTML =
        `<p class="card-empty">${MindTraceUtils.escapeHtml(getText('recallEmpty'))}</p>`;
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

    const rd = new Date(record.createdAt);
    const dateLine = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
    const quote = MindTraceUtils.escapeHtml(getRecallText(record));

    recallContentEl.innerHTML = `
      <blockquote class="recall-quote">${quote}</blockquote>
      <p class="recall-date">—— ${MindTraceUtils.escapeHtml(dateLine)}</p>
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
    const token = ++searchInFlight;
    try {
      const result = await MindTraceStorage.searchWithMeta(
        query || '',
        currentGardenId
      );
      if (token !== searchInFlight) {
        return;
      }
      filteredItems = result.items;
      lastSearchMode = result.mode || 'keyword';
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
        `<p class="stream-empty">${MindTraceUtils.escapeHtml(getText('timelineLoadFailed'))}</p>`;
    }
  }

  async function updateTimelineHeader(shownCount, query) {
    const total = await MindTraceStorage.count(currentGardenId);
    const q = (query || '').trim();

    if (q) {
      const modeExtra = searchModeHint(lastSearchMode, q);
      flowHintEl.textContent =
        shownCount > 0
          ? modeExtra
            ? getText('timelineSearchWithMode', [q, modeExtra])
            : getText('timelineSearchRelated', [q])
          : getText('timelineSearchEmpty');
      timelineCountEl.textContent =
        shownCount > 0 ? getText('timelineRelatedCount', [shownCount]) : '';
    } else {
      flowHintEl.textContent = getText('flowHintDefault');
      timelineCountEl.textContent = total > 0 ? getText('timelineTotalCount', [total]) : '';
    }
  }

  function renderTimelineEmpty(query) {
    const hasQuery = query && query.trim();
    timelineEl.innerHTML = `
      <p class="stream-empty">${
        hasQuery
          ? getText('timelineEmptySearch')
          : getText('timelineEmptyDefault')
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
        setStreamStatus(getText('allLoaded'));
      }
      updateLoadMoreButton();
      return;
    }

    isLoadingMore = true;
    setStreamStatus(getText('loading'), true);

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
        filteredItems.length > PAGE_SIZE ? getText('allLoaded') : ''
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
    const weekdays = WEEKDAY_KEYS.map((key) => getText(key));
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
        title: title || getText('noThoughtWritten'),
        body: bodyParts.join('\n\n'),
      };
    }

    if (selected) {
      if (selected.length <= 72) {
        return { title: selected, body: '' };
      }
      return { title: selected.slice(0, 72) + '…', body: selected };
    }

    return { title: getText('noThoughtWritten'), body: '' };
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
      <button type="button" class="thought-more" data-expand-id="${expandId}" data-expanded="false">${MindTraceUtils.escapeHtml(getText('continueReading'))}</button>
    `;
  }

  function getRelatedDisplayLabel(record) {
    const { title } = splitThoughtContent(record);
    const label = (title || '').trim();
    if (!label || label === getText('noThoughtWritten') || label.startsWith('（')) {
      return getText('relatedThought');
    }
    return label.length > 56 ? label.slice(0, 56) + '…' : label;
  }

  function getRelatedForItem(item) {
    if (typeof MindTraceRelatedService !== 'undefined') {
      return MindTraceRelatedService.toRelationView(item, allItems);
    }
    return MindTraceRelationService.findRelatedThoughts(item, allItems);
  }

  function formatRelationScore(score) {
    if (typeof score !== 'number') {
      return '';
    }
    const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
    return pct >= 18 ? `${(score).toFixed(2)}` : '';
  }

  function buildRelatedThoughtsHtml(item) {
    const related = getRelatedForItem(item);
    if (!related.length) {
      return '';
    }

    const listItems = related
      .map(({ record, score }) => {
        const label = MindTraceUtils.escapeHtml(
          getRelatedDisplayLabel(record)
        );
        const scoreText = formatRelationScore(score);
        const scoreHtml = scoreText
          ? `<span class="thought-related-score">${MindTraceUtils.escapeHtml(getText('relationScore', [scoreText]))}</span>`
          : '';
        return `<li class="thought-related-item">
          <button type="button" class="thought-related-link" data-open-detail-id="${MindTraceUtils.escapeHtml(record.id)}">
            <span class="thought-related-title">${label}</span>${scoreHtml}
          </button>
        </li>`;
      })
      .join('');

    return `
      <div class="thought-related" aria-label="${MindTraceUtils.escapeHtml(getText('relatedThoughtsAria'))}">
        <p class="thought-related-label">${MindTraceUtils.escapeHtml(getText('relatedIdeas'))}</p>
        <ul class="thought-related-list">${listItems}</ul>
      </div>
    `;
  }

  function buildThoughtTagsHtml(item) {
    const tags = item.tags || [];
    if (!tags.length) {
      return '';
    }
    const pills = tags
      .map(
        (t) =>
          `<span class="tag-pill thought-tag-pill">${MindTraceUtils.escapeHtml(t)}</span>`
      )
      .join('');
    return `<div class="thought-tags" aria-label="${MindTraceUtils.escapeHtml(getText('cognitiveTagsAria'))}">${pills}</div>`;
  }

  function buildCognitivePathHtml(item) {
    const tags = (item.tags || []).join(' → ');
    const source = (item.pageTitle || '').trim() || getText('unknownSource');
    const path = tags
      ? `${tags} · ${getText('fromSource', [source])}`
      : getText('fromSource', [source]);
    return `<p class="thought-cognitive-path"><span class="thought-cognitive-path-label">${MindTraceUtils.escapeHtml(getText('cognitivePathLabel'))}</span>${MindTraceUtils.escapeHtml(path)}</p>`;
  }

  function openThoughtDetail(thoughtId) {
    if (!thoughtDetailDialogEl || !thoughtDetailBodyEl) {
      focusThoughtInTimeline(thoughtId);
      return;
    }
    const item = findItemById(thoughtId);
    if (!item) {
      return;
    }

    const { title, body } = splitThoughtContent(item);
    const related = getRelatedForItem(item);
    const relatedHtml = related.length
      ? `<section class="thought-detail-section">
          <h4 class="thought-detail-section-title">${MindTraceUtils.escapeHtml(getText('relatedIdeas'))}</h4>
          <ul class="thought-related-list">
            ${related
              .map(({ record, score }) => {
                const label = MindTraceUtils.escapeHtml(
                  getRelatedDisplayLabel(record)
                );
                const sc = formatRelationScore(score);
                return `<li><button type="button" class="thought-related-link" data-open-detail-id="${MindTraceUtils.escapeHtml(record.id)}">${label}${sc ? ` <span class="thought-related-score">(${sc})</span>` : ''}</button></li>`;
              })
              .join('')}
          </ul>
        </section>`
      : '';

    const themesHtml =
      (item.tags || []).length > 0
        ? `<section class="thought-detail-section">
            <h4 class="thought-detail-section-title">${MindTraceUtils.escapeHtml(getText('relatedThemes'))}</h4>
            <div class="tag-row">${(item.tags || [])
              .map(
                (t) =>
                  `<span class="tag-pill">${MindTraceUtils.escapeHtml(t)}</span>`
              )
              .join('')}</div>
          </section>`
        : '';

    const created = MindTraceUtils.formatDate(item.createdAt);
    const updated = item.updatedAt
      ? MindTraceUtils.formatDate(item.updatedAt)
      : created;
    const pageTitleEsc = MindTraceUtils.escapeHtml(item.pageTitle || getText('unknownPage'));
    const pageUrlEsc = MindTraceUtils.escapeHtml(item.pageUrl || '#');

    thoughtDetailBodyEl.innerHTML = `
      <h3 class="thought-detail-headline">${MindTraceUtils.escapeHtml(title)}</h3>
      ${item.selectedText ? `<blockquote class="thought-detail-quote">${MindTraceUtils.escapeHtml(item.selectedText)}</blockquote>` : ''}
      ${body ? `<div class="thought-detail-note">${MindTraceUtils.escapeHtml(body).replace(/\n/g, '<br>')}</div>` : ''}
      ${buildThoughtTagsHtml(item)}
      ${themesHtml}
      ${relatedHtml}
      <section class="thought-detail-section">
        <h4 class="thought-detail-section-title">${MindTraceUtils.escapeHtml(getText('source'))}</h4>
        <p><a href="${pageUrlEsc}" target="_blank" rel="noopener noreferrer">${pageTitleEsc}</a></p>
      </section>
      ${buildCognitivePathHtml(item)}
      <p class="thought-detail-meta">${MindTraceUtils.escapeHtml(getText('createdAt', [created]))}${item.updatedAt ? MindTraceUtils.escapeHtml(getText('editedAt', [updated])) : ''}</p>
    `;

    thoughtDetailBodyEl.querySelectorAll('[data-open-detail-id]').forEach(
      (btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-open-detail-id');
          if (id) {
            openThoughtDetail(id);
          }
        });
      }
    );

    if (typeof thoughtDetailDialogEl.showModal === 'function') {
      thoughtDetailDialogEl.showModal();
    } else {
      thoughtDetailDialogEl.setAttribute('open', '');
    }
  }

  function setupThoughtDetailDialog() {
    if (!thoughtDetailDialogEl) {
      return;
    }
    const close = () => {
      if (typeof thoughtDetailDialogEl.close === 'function') {
        thoughtDetailDialogEl.close();
      } else {
        thoughtDetailDialogEl.removeAttribute('open');
      }
    };
    if (thoughtDetailCloseEl) {
      thoughtDetailCloseEl.addEventListener('click', close);
    }
    if (thoughtDetailDismissEl) {
      thoughtDetailDismissEl.addEventListener('click', close);
    }
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

  function shouldShowUserEvidence(item) {
    const ids = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const preview = (item.previewImageUrl || '').trim();
    if (item.userEvidence === true) {
      return ids.length > 0 || !!preview;
    }
    return ids.length > 0;
  }

  function buildEvidenceShellHtml(item) {
    if (!shouldShowUserEvidence(item)) {
      return '';
    }
    const ids = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const extra =
      ids.length > MAX_EVIDENCE_DISPLAY
        ? `<span class="thought-evidence-more">+${ids.length - MAX_EVIDENCE_DISPLAY}</span>`
        : '';
    return `<div class="thought-evidence" data-thought-id="${MindTraceUtils.escapeHtml(item.id)}" aria-label="${MindTraceUtils.escapeHtml(getText('inspirationSceneAria'))}">
        <span class="thought-evidence-label">${MindTraceUtils.escapeHtml(getText('inspirationSceneLabel'))}</span>
        ${extra}
      </div>`;
  }

  /**
   * @param {HTMLElement} container
   * @param {InspirationRecord} item
   */
  async function hydrateEvidenceThumbs(container, item) {
    if (!container) {
      return;
    }

    if (!shouldShowUserEvidence(item)) {
      container.remove();
      return;
    }

    const ids = (item.images || []).slice(0, MAX_EVIDENCE_DISPLAY);
    const moreEl = container.querySelector('.thought-evidence-more');
    const labelEl = container.querySelector('.thought-evidence-label');
    container.innerHTML = '';
    if (labelEl) {
      container.appendChild(labelEl);
    }
    if (moreEl) {
      container.appendChild(moreEl);
    }

    if (ids.length && typeof MindTraceImageStorage !== 'undefined') {
      await MindTraceImageStorage.migrateIfNeeded();
      const urlMap = await MindTraceImageStorage.getObjectUrlsBatch(ids);
      ids.forEach((imageId) => {
        const url = urlMap[imageId];
        if (!url) {
          return;
        }
        imageObjectUrlCache.add(url);
        appendEvidenceThumb(container, url, moreEl);
      });
    }

    if (!container.querySelector('.thought-evidence-thumb')) {
      const fallbackUrl = (item.previewImageUrl || '').trim();
      if (item.userEvidence === true && fallbackUrl) {
        appendEvidenceThumb(container, fallbackUrl, moreEl, { remote: true });
      }
    }

    if (!container.querySelector('.thought-evidence-thumb')) {
      container.remove();
      return;
    }

    bindEvidenceThumbClicks(container);
  }

  /**
   * @param {HTMLElement} container
   * @param {string} url
   * @param {Element|null} moreEl
   * @param {{ remote?: boolean }} [options]
   */
  function appendEvidenceThumb(container, url, moreEl, options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thought-evidence-thumb';
    btn.dataset.fullUrl = url;
    if (options && options.remote) {
      btn.dataset.remotePreview = '1';
    }
    btn.setAttribute('aria-label', getText('zoomEvidenceAria'));
    const img = document.createElement('img');
    img.src = url;
    img.alt = getText('pagePreviewAlt');
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      btn.remove();
      if (!container.querySelector('.thought-evidence-thumb')) {
        container.remove();
      }
    });
    btn.appendChild(img);
    container.insertBefore(btn, moreEl || null);
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
          openEvidenceLightbox(url, btn);
        }
      });
    });
  }

  /**
   * @param {string} url
   * @param {HTMLElement} [triggerEl]
   */
  function openEvidenceLightbox(url, triggerEl) {
    if (!evidenceLightboxEl || !evidenceLightboxImgEl) {
      window.open(url, '_blank');
      return;
    }
    evidenceLightboxLastTriggerEl = triggerEl || null;
    evidenceLightboxImgEl.src = url;
    evidenceLightboxEl.hidden = false;
    evidenceLightboxEl.setAttribute('aria-hidden', 'false');
    const closeBtn = evidenceLightboxEl.querySelector('.evidence-lightbox-close');
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeEvidenceLightbox() {
    if (!evidenceLightboxEl || !evidenceLightboxImgEl) {
      return;
    }
    const activeEl =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeEl && evidenceLightboxEl.contains(activeEl)) {
      activeEl.blur();
    }
    evidenceLightboxEl.hidden = true;
    evidenceLightboxEl.setAttribute('aria-hidden', 'true');
    evidenceLightboxImgEl.removeAttribute('src');
    if (
      evidenceLightboxLastTriggerEl &&
      document.contains(evidenceLightboxLastTriggerEl)
    ) {
      evidenceLightboxLastTriggerEl.focus();
    }
    evidenceLightboxLastTriggerEl = null;
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
      MindTraceUtils.truncate(pageTitle || getText('sourceChip'), 14)
    );
    const url = MindTraceUtils.escapeHtml(pageUrl);
    return `
      <div class="thought-chips">
        <a class="thought-chip" href="${url}" target="_blank" rel="noopener noreferrer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          ${MindTraceUtils.escapeHtml(getText('viewSource'))}
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
    const emptyTitle = getText('noThoughtWritten');
    const titleClass =
      title === emptyTitle || title.startsWith('（')
      ? 'thought-title thought-title-empty'
      : 'thought-title';
    const titleHtml = `<h3 class="${titleClass}">${MindTraceUtils.escapeHtml(title)}</h3>`;
    const bodyHtml = buildBodyHtml(body);

    const pageTitle = item.pageTitle || getText('unknownPage');
    const pageUrl = item.pageUrl || '#';
    const pageTitleEsc = MindTraceUtils.escapeHtml(pageTitle);
    const pageUrlEsc = MindTraceUtils.escapeHtml(pageUrl);
    const idEscaped = MindTraceUtils.escapeHtml(item.id);
    const chipsHtml = buildChipsHtml(pageUrl, pageTitle);
    const evidenceHtml = buildEvidenceShellHtml(item);
    const tagsHtml = buildThoughtTagsHtml(item);
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
          <button type="button" class="btn-menu" aria-label="${MindTraceUtils.escapeHtml(getText('moreActionsAria'))}" aria-expanded="false">···</button>
          <div class="menu-dropdown">
            <button type="button" data-detail-id="${idEscaped}">${MindTraceUtils.escapeHtml(getText('cognitiveDetail'))}</button>
            <button type="button" data-edit-id="${idEscaped}">${MindTraceUtils.escapeHtml(getText('editThought'))}</button>
            <button type="button" data-remove-id="${idEscaped}">${MindTraceUtils.escapeHtml(getText('removeThought'))}</button>
          </div>
        </div>
        ${titleHtml}
        ${bodyHtml}
        ${tagsHtml}
        ${evidenceHtml}
        ${chipsHtml}
        <p class="thought-origin">${MindTraceUtils.escapeHtml(getText('originLabel'))}<a href="${pageUrlEsc}" target="_blank" rel="noopener noreferrer">${pageTitleEsc}</a></p>
        ${relatedHtml}
      </div>
    `;

    bindCardMenu(piece, item);
    bindExpandButtons(piece);
    piece.querySelectorAll('[data-open-detail-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-open-detail-id');
        if (id) {
          openThoughtDetail(id);
        }
      });
    });
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
    const emptyTitle = getText('noThoughtWritten');
    const titleClass =
      title === emptyTitle || title.startsWith('（')
      ? 'thought-title thought-title-empty'
      : 'thought-title';
    const titleHtml = `<h3 class="${titleClass}">${MindTraceUtils.escapeHtml(title)}</h3>`;
    const bodyHtml = buildBodyHtml(body);
    const chipsHtml = buildChipsHtml(item.pageUrl, item.pageTitle);
    const pageTitleEsc = MindTraceUtils.escapeHtml(item.pageTitle || getText('unknownPage'));
    const pageUrlEsc = MindTraceUtils.escapeHtml(item.pageUrl || '#');
    const originHtml = `<p class="thought-origin">${MindTraceUtils.escapeHtml(getText('originLabel'))}<a href="${pageUrlEsc}" target="_blank" rel="noopener noreferrer">${pageTitleEsc}</a></p>`;
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
        placeholder="${MindTraceUtils.escapeHtml(getText('editTitlePlaceholder'))}"
        aria-label="${MindTraceUtils.escapeHtml(getText('editTitleAria'))}"
      />
      <textarea
        class="thought-edit-body"
        rows="3"
        placeholder="${MindTraceUtils.escapeHtml(getText('editBodyPlaceholder'))}"
        aria-label="${MindTraceUtils.escapeHtml(getText('editBodyAria'))}"
      ></textarea>
      <div class="timeline-card-edit-actions">
        <button type="button" class="btn-edit-save">${MindTraceUtils.escapeHtml(getText('saveEdit'))}</button>
        <button type="button" class="btn-edit-cancel">${MindTraceUtils.escapeHtml(getText('cancel'))}</button>
      </div>
    `;

    const titleInput = editPanel.querySelector('.thought-edit-title');
    const bodyTextarea = editPanel.querySelector('.thought-edit-body');
    titleInput.value =
      title === getText('noThoughtWritten') || title.startsWith('（') ? '' : title;
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
      alert(getText('editEmptyAlert'));
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
      await renderTodayCard(allItems);
      if (currentRecallId === id) {
        renderWhisper(allItems, false);
      }
    } catch (err) {
      console.error('[MindTrace] 保存失败:', err);
      alert(getText('saveFailed'));
    } finally {
      saveBtn.disabled = false;
    }
  }

  function bindCardMenu(piece, item) {
    const menuBtn = piece.querySelector('.btn-menu');
    const dropdown = piece.querySelector('.menu-dropdown');
    const removeBtn = piece.querySelector('[data-remove-id]');
    const editBtn = piece.querySelector('[data-edit-id]');
    const detailBtn = piece.querySelector('[data-detail-id]');

    if (!menuBtn || !dropdown) {
      return;
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      const open = dropdown.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        const id = detailBtn.getAttribute('data-detail-id');
        if (id) {
          openThoughtDetail(id);
        }
      });
    }

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
      btn.textContent = getText('continueReading');
      btn.setAttribute('data-expanded', 'false');
    } else {
      el.classList.remove('thought-body-collapsed');
      btn.textContent = getText('collapse');
      btn.setAttribute('data-expanded', 'true');
    }
  }
  async function onRemoveClick(event) {
    const id = event.currentTarget.getAttribute('data-remove-id');
    if (!id) {
      return;
    }

    if (!confirm(getText('confirmRemoveThought'))) {
      return;
    }

    try {
      await MindTraceStorage.deleteById(id);
      await reloadAllData(searchInput.value);
    } catch (err) {
      console.error('[MindTrace] 移除失败:', err);
      alert(getText('removeFailed'));
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
        alert(getText('exportEmpty'));
        return;
      }

      const garden = gardens.find((g) => g.id === currentGardenId);
      downloadMarkdownFile(
        buildMarkdownDocument(items, garden),
        buildExportFilename(garden)
      );
    } catch (err) {
      console.error('[MindTrace] 导出失败:', err);
      alert(getText('exportFailed'));
    } finally {
      exportMdBtn.disabled = false;
    }
  }

  function buildMarkdownDocument(items, garden) {
    const header = garden
      ? `${getText('exportHeader', [escapeMarkdownHeading(garden.name)])}\n\n`
      : '';
    const blocks = items.map((item) => formatRecordAsMarkdown(item));
    return header + blocks.join('\n\n' + RECORD_SEPARATOR + '\n\n') + '\n';
  }

  function formatRecordAsMarkdown(record) {
    const title = getRecordTitle(record);
    const time = formatExportDateTime(record.createdAt);
    const pageTitle = (record.pageTitle || getText('unknownPage')).trim();
    const pageUrl = (record.pageUrl || '').trim();
    const selectedText = (record.selectedText || '').trim();
    const note = (record.note || '').trim();

    return [
      `# ${escapeMarkdownHeading(title)}`,
      '',
      `${getText('exportTime')}${time}`,
      '',
      getText('exportSourcePage'),
      pageTitle,
      '',
      getText('exportWebLink'),
      pageUrl || getText('exportNone'),
      '',
      '---',
      '',
      getText('exportOriginal'),
      '',
      selectedText || getText('exportNone'),
      '',
      '---',
      '',
      getText('exportMyThought'),
      '',
      note || getText('exportNone'),
    ].join('\n');
  }

  function getRecordTitle(record) {
    const note = (record.note || '').trim();
    const selected = (record.selectedText || '').trim();
    const source = note || selected || getText('untitled');
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
