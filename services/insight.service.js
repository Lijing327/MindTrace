/**
 * MindTrace — Insight Engine（认知洞察引擎）
 * 本地观察：keywords + embedding clusters + relation + timeline + garden
 * 非聊天助手，输出「认知镜子」式观察
 */

const MindTraceInsightService = (function () {
  'use strict';

  const INSIGHT_VERSION = 1;
  const STORAGE_KEY = 'mindtrace_insights_cache';
  const DEBOUNCE_MS = 900;
  const MIN_THOUGHTS = 2;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOW_RECENT = 30 * DAY_MS;
  const WINDOW_PRIOR = 30 * DAY_MS;
  const TOP_THEME_DAYS = 14 * DAY_MS;

  const INSIGHT_TYPES = {
    TOP_THEME: 'top-theme',
    LONG_TERM: 'long-term-interest',
    EVOLUTION: 'cognitive-evolution',
    GARDEN_FOCUS: 'garden-focus',
  };

  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const debounceTimers = new Map();

  /** @type {Set<string>} */
  const dirtyScopes = new Set();

  /** @type {Map<string, Promise<Insight[]>>} */
  const inflight = new Map();

  const STOPWORDS = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
    '好', '自己', '这', '那', '什么', '怎么', '可以', '这个', '那个', '已经',
    '因为', '所以', '如果', '但是', '或者', '以及', '还有', '就是', '而且',
    '只是', '可能', '应该', '需要', '觉得', '感觉', '知道', '认为', '关于',
    '对于', '进行', '通过', '使用', '问题', '方法', '方式', '东西', '情况',
    '时候', '现在', '之后', '之前', '然后', '其实', '真的', '非常', '比较',
    '更加', '一些', '一点', '这些', '那些', '还是', '只能', '作为', '成为',
    '开始', '结束', '想要', '希望', '喜欢', '正在', '将会', '能够', '不能',
    '不会', '不要', '没什么', '有点', '一下', '一种', '一样', '一直', '一定',
  ]);

  /**
   * @param {string|null|undefined} gardenId
   * @returns {string}
   */
  function scopeKey(gardenId) {
    return gardenId ? `garden:${gardenId}` : 'global';
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string|null} gardenId
   * @returns {string}
   */
  function computeFingerprint(thoughts, gardenId) {
    const list = thoughts || [];
    let maxTs = 0;
    let hash = 0;
    list.forEach((t) => {
      const ts = Math.max(t.createdAt || 0, t.updatedAt || 0);
      if (ts > maxTs) {
        maxTs = ts;
      }
      const id = t.id || '';
      for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
      }
    });
    return `${INSIGHT_VERSION}:${gardenId || 'global'}:${list.length}:${maxTs}:${hash}`;
  }

  /**
   * @returns {Promise<{ version: number, entries: Object }>}
   */
  async function loadCacheStore() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY];
    if (!store || typeof store !== 'object') {
      return { version: INSIGHT_VERSION, entries: {} };
    }
    if (!store.entries || typeof store.entries !== 'object') {
      return { version: INSIGHT_VERSION, entries: {} };
    }
    return store;
  }

  /**
   * @param {Object} store
   * @returns {Promise<void>}
   */
  async function saveCacheStore(store) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: { version: INSIGHT_VERSION, entries: store.entries },
    });
  }

  /**
   * @param {InspirationRecord} thought
   * @returns {string}
   */
  function getThoughtText(thought) {
    if (!thought) {
      return '';
    }
    return [thought.note, thought.selectedText, thought.pageTitle]
      .filter((p) => p && String(p).trim())
      .join('\n');
  }

  /**
   * @param {string} text
   * @returns {string[]}
   */
  function tokenize(text) {
    if (typeof MindTraceKeywordService !== 'undefined') {
      return MindTraceKeywordService.extractKeywords(text);
    }
    const tokens = [];
    const chineseRe = /[\u4e00-\u9fa5]{2,4}/g;
    let match;
    while ((match = chineseRe.exec(text)) !== null) {
      if (!STOPWORDS.has(match[0])) {
        tokens.push(match[0]);
      }
    }
    const english = text.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g);
    if (english) {
      english.forEach((w) => tokens.push(w.toLowerCase()));
    }
    return tokens;
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {number} sinceMs
   * @returns {Map<string, number>}
   */
  function collectKeywordFreq(thoughts, sinceMs) {
    const freq = new Map();
    const now = Date.now();
    (thoughts || []).forEach((t) => {
      if (sinceMs && now - (t.createdAt || 0) > sinceMs) {
        return;
      }
      tokenize(getThoughtText(t)).forEach((kw) => {
        freq.set(kw, (freq.get(kw) || 0) + 1);
      });
      (t.keywords || []).forEach((kw) => {
        if (kw && !STOPWORDS.has(kw)) {
          freq.set(kw, (freq.get(kw) || 0) + 1);
        }
      });
    });
    return freq;
  }

  /**
   * @param {Map<string, number>} freq
   * @param {number} n
   * @returns {string[]}
   */
  function topFromFreq(freq, n) {
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([word]) => word);
  }

  /**
   * @param {string[]} words
   * @returns {string}
   */
  function formatTopicList(words) {
    const list = (words || []).filter(Boolean).slice(0, 5);
    if (!list.length) {
      return '';
    }
    if (list.length === 1) {
      return list[0];
    }
    if (list.length === 2) {
      return `${list[0]}、${list[1]}`;
    }
    return `${list.slice(0, -1).join('、')}、${list[list.length - 1]}`;
  }

  /**
   * @param {Partial<Insight>} partial
   * @returns {Insight}
   */
  function buildInsight(partial) {
    return {
      id: partial.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      gardenId: partial.gardenId !== undefined ? partial.gardenId : null,
      type: partial.type || 'observation',
      title: partial.title || '',
      content: partial.content || '',
      score: typeof partial.score === 'number' ? partial.score : 0.5,
      relatedThoughtIds: partial.relatedThoughtIds || [],
      createdAt: partial.createdAt || Date.now(),
      insightVersion: INSIGHT_VERSION,
      confidence:
        typeof partial.confidence === 'number' ? partial.confidence : 0.65,
    };
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string|null} gardenId
   * @returns {Insight[]}
   */
  function generateTopThemeInsight(thoughts, gardenId) {
    const now = Date.now();
    const recent = thoughts.filter(
      (t) => now - (t.createdAt || 0) <= TOP_THEME_DAYS
    );
    const pool = recent.length >= MIN_THOUGHTS ? recent : thoughts;
    if (pool.length < MIN_THOUGHTS) {
      return [];
    }

    const freq = collectKeywordFreq(pool, 0);
    let themes = topFromFreq(freq, 4);

    let relatedIds = [];
    let clusterScore = 0;

    if (typeof MindTraceGraphService !== 'undefined') {
      const graph = MindTraceGraphService.buildGraph(pool);
      const degreeMap = new Map();
      (graph.nodes || []).forEach((n) => {
        degreeMap.set(n.id, n.degree || 0);
      });
      const denseNodes = (graph.nodes || [])
        .filter((n) => (n.degree || 0) >= 2)
        .sort((a, b) => (b.degree || 0) - (a.degree || 0));

      if (denseNodes.length) {
        relatedIds = denseNodes.slice(0, 6).map((n) => n.id);
        clusterScore = Math.min(1, denseNodes.length / Math.max(3, pool.length));
        const clusterKeywords = new Map();
        denseNodes.forEach((node) => {
          const thought = pool.find((t) => t.id === node.id);
          if (!thought) {
            return;
          }
          tokenize(getThoughtText(thought)).forEach((kw) => {
            clusterKeywords.set(kw, (clusterKeywords.get(kw) || 0) + 1);
          });
        });
        const fromCluster = topFromFreq(clusterKeywords, 3);
        if (fromCluster.length) {
          themes = [...new Set([...fromCluster, ...themes])].slice(0, 4);
        }
      }
    }

    if (themes.length < 2) {
      return [];
    }

    const topicStr = formatTopicList(themes);
    const score = Math.min(
      0.95,
      0.45 + themes.length * 0.08 + clusterScore * 0.35
    );

    return [
      buildInsight({
        gardenId,
        type: INSIGHT_TYPES.TOP_THEME,
        title: '最近高频主题',
        content: `${topicStr} 正在形成新的认知聚类，彼此之间的语义联系比往常更紧密。`,
        score,
        relatedThoughtIds: relatedIds,
        confidence: 0.55 + clusterScore * 0.3,
      }),
    ];
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string|null} gardenId
   * @returns {Insight[]}
   */
  function generateLongTermInsight(thoughts, gardenId) {
    const now = Date.now();
    const windowed = thoughts.filter(
      (t) => now - (t.createdAt || 0) <= WINDOW_RECENT
    );
    if (windowed.length < MIN_THOUGHTS) {
      return [];
    }

    const freq = collectKeywordFreq(windowed, 0);
    const topics = topFromFreq(freq, 4);
    if (topics.length < 2) {
      return [];
    }

    const topicStr = formatTopicList(topics);
    const lines = topics.map((t) => `· ${t}`).join('\n');
    const score = Math.min(0.9, 0.4 + topics.length * 0.1);

    return [
      buildInsight({
        gardenId,
        type: INSIGHT_TYPES.LONG_TERM,
        title: '长期稳定关注',
        content: `在过去约 30 天里，你长期稳定关注：\n${lines}\n\n其中 ${topicStr} 出现得最频繁，像一条缓慢延伸的主线。`,
        score,
        relatedThoughtIds: windowed.slice(0, 8).map((t) => t.id),
        confidence: 0.7,
      }),
    ];
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string|null} gardenId
   * @returns {Insight[]}
   */
  function generateEvolutionInsight(thoughts, gardenId) {
    const now = Date.now();
    const recentStart = now - WINDOW_RECENT;
    const priorEnd = recentStart;
    const priorStart = priorEnd - WINDOW_PRIOR;

    const recent = thoughts.filter(
      (t) => (t.createdAt || 0) >= recentStart
    );
    const prior = thoughts.filter(
      (t) =>
        (t.createdAt || 0) >= priorStart && (t.createdAt || 0) < priorEnd
    );

    if (recent.length < MIN_THOUGHTS || prior.length < MIN_THOUGHTS) {
      return [];
    }

    const recentTopics = topFromFreq(collectKeywordFreq(recent, 0), 4);
    const priorTopics = topFromFreq(collectKeywordFreq(prior, 0), 4);

    if (!recentTopics.length || !priorTopics.length) {
      return [];
    }

    const priorSet = new Set(priorTopics);
    const emerging = recentTopics.filter((t) => !priorSet.has(t));
    const fading = priorTopics.filter(
      (t) => !recentTopics.includes(t)
    );

    if (!emerging.length && !fading.length) {
      return [];
    }

    const fromLabel = formatTopicList(
      fading.length ? fading.slice(0, 2) : priorTopics.slice(0, 2)
    );
    const toLabel = formatTopicList(
      emerging.length ? emerging.slice(0, 2) : recentTopics.slice(0, 2)
    );

    const overlap = recentTopics.filter((t) => priorSet.has(t)).length;
    const shift = 1 - overlap / Math.max(recentTopics.length, 1);
    const score = Math.min(0.92, 0.35 + shift * 0.5);

    return [
      buildInsight({
        gardenId,
        type: INSIGHT_TYPES.EVOLUTION,
        title: '认知演化',
        content: `你的思维正在从「${fromLabel || '较早的主题'}」向「${toLabel || '新的方向'}」演化；最近 30 天与再早 30 天相比，关注重心出现了可见偏移。`,
        score,
        relatedThoughtIds: [...recent, ...prior]
          .slice(0, 10)
          .map((t) => t.id),
        confidence: 0.5 + shift * 0.35,
      }),
    ];
  }

  /**
   * @param {InspirationRecord[]} allThoughts
   * @param {Garden[]} gardens
   * @returns {Insight[]}
   */
  function generateGardenFocusInsight(allThoughts, gardens) {
    const now = Date.now();
    const windowed = allThoughts.filter(
      (t) => now - (t.createdAt || 0) <= WINDOW_RECENT
    );
    if (windowed.length < MIN_THOUGHTS || (gardens || []).length < 2) {
      return [];
    }

    const counts = new Map();
    windowed.forEach((t) => {
      const gid =
        typeof MindTraceGardenService !== 'undefined'
          ? MindTraceGardenService.resolveGardenId(t)
          : t.gardenId || 'garden-default';
      counts.set(gid, (counts.get(gid) || 0) + 1);
    });

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const names = ranked
      .map(([gid]) => {
        const g = gardens.find((x) => x.id === gid);
        return g ? `${g.icon || '🌿'} ${g.name}` : gid;
      })
      .filter(Boolean);

    if (!names.length) {
      return [];
    }

    const list = names.map((n) => `· ${n}`).join('\n');
    const score = Math.min(0.88, 0.4 + ranked[0][1] / windowed.length);

    return [
      buildInsight({
        gardenId: null,
        type: INSIGHT_TYPES.GARDEN_FOCUS,
        title: '注意力分布',
        content: `最近你的主要注意力集中在：\n${list}\n\n不同认知宇宙之间的投入并不均衡，这往往意味着生活重心正在迁移。`,
        score,
        relatedThoughtIds: windowed.slice(0, 6).map((t) => t.id),
        confidence: 0.62,
      }),
    ];
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string|null} gardenId
   * @param {Garden[]} gardens
   * @returns {Insight[]}
   */
  function generateInsightsForScope(thoughts, gardenId, gardens) {
    const insights = [];

    insights.push(...generateTopThemeInsight(thoughts, gardenId));
    insights.push(...generateLongTermInsight(thoughts, gardenId));
    insights.push(...generateEvolutionInsight(thoughts, gardenId));

    if (!gardenId && gardens && gardens.length) {
      insights.push(
        ...generateGardenFocusInsight(thoughts, gardens)
      );
    }

    return insights
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 6);
  }

  /**
   * @param {string|null} gardenId
   * @returns {Promise<InspirationRecord[]>}
   */
  async function loadThoughtsForScope(gardenId) {
    if (typeof MindTraceStorage === 'undefined') {
      return [];
    }
    if (gardenId) {
      return MindTraceStorage.getAllForGarden(gardenId);
    }
    return MindTraceStorage.getAllRaw();
  }

  /**
   * @param {string|null} gardenId
   * @param {boolean} [force]
   * @returns {Promise<Insight[]>}
   */
  async function regenerate(gardenId, force) {
    const key = scopeKey(gardenId);
    if (!force && inflight.has(key)) {
      return inflight.get(key);
    }

    const task = (async () => {
      const thoughts = await loadThoughtsForScope(gardenId);
      const gardens =
        typeof MindTraceGardenService !== 'undefined'
          ? await MindTraceGardenService.getGardens()
          : [];
      const fingerprint = computeFingerprint(thoughts, gardenId);
      const insights = generateInsightsForScope(
        thoughts,
        gardenId,
        gardens
      );

      const store = await loadCacheStore();
      store.entries[key] = {
        fingerprint,
        insights,
        generatedAt: Date.now(),
      };
      await saveCacheStore(store);
      dirtyScopes.delete(key);
      return insights;
    })();

    inflight.set(key, task);
    try {
      return await task;
    } finally {
      inflight.delete(key);
    }
  }

  /**
   * @param {string|null} gardenId
   * @returns {Promise<Insight[]>}
   */
  async function getInsights(gardenId) {
    const key = scopeKey(gardenId);
    const thoughts = await loadThoughtsForScope(gardenId);
    const fingerprint = computeFingerprint(thoughts, gardenId);
    const store = await loadCacheStore();
    const entry = store.entries[key];

    if (
      entry &&
      entry.fingerprint === fingerprint &&
      Array.isArray(entry.insights) &&
      !dirtyScopes.has(key)
    ) {
      return entry.insights;
    }

    return regenerate(gardenId, false);
  }

  /**
   * 读取缓存（不触发重算），用于首屏快速渲染
   * @param {string|null} gardenId
   * @returns {Promise<Insight[]>}
   */
  async function getCachedInsights(gardenId) {
    const key = scopeKey(gardenId);
    const store = await loadCacheStore();
    const entry = store.entries[key];
    return entry && Array.isArray(entry.insights) ? entry.insights : [];
  }

  /**
   * @param {string|null} [gardenId]
   */
  function markDirty(gardenId) {
    dirtyScopes.add(scopeKey(gardenId || null));
    if (gardenId) {
      dirtyScopes.add('global');
    }
  }

  /**
   * @param {string|null} [gardenId]
   */
  function scheduleRegenerate(gardenId) {
    const key = scopeKey(gardenId);
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
    }
    debounceTimers.set(
      key,
      setTimeout(() => {
        debounceTimers.delete(key);
        regenerate(gardenId, true).catch((err) => {
          console.warn('[MindTrace Insight] regenerate failed:', err);
        });
      }, DEBOUNCE_MS)
    );
  }

  /**
   * 数据变更后：标记脏数据并防抖重算（花园 + 全局）
   * @param {string} [thoughtGardenId]
   */
  function onThoughtsChanged(thoughtGardenId) {
    if (thoughtGardenId) {
      markDirty(thoughtGardenId);
      scheduleRegenerate(thoughtGardenId);
    }
    markDirty(null);
    scheduleRegenerate(null);
  }

  return {
    INSIGHT_VERSION,
    INSIGHT_TYPES,
    STORAGE_KEY,
    DEBOUNCE_MS,
    getInsights,
    getCachedInsights,
    regenerate,
    scheduleRegenerate,
    markDirty,
    onThoughtsChanged,
    computeFingerprint,
    generateInsightsForScope,
  };
})();

/**
 * @typedef {Object} Insight
 * @property {string} id
 * @property {string|null} gardenId
 * @property {string} type
 * @property {string} title
 * @property {string} content
 * @property {number} score
 * @property {string[]} relatedThoughtIds
 * @property {number} createdAt
 * @property {number} insightVersion
 * @property {number} confidence
 */
