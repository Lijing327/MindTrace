/**
 * MindTrace — 主题星系（canonical 主题 → 思考 二级结构）
 * 思维宇宙的数据层：左侧/图谱/详情均以「主题」为一等公民，记录为二等节点。
 */

const MindTraceThemeGalaxyService = (function () {
  'use strict';

  const CANONICAL_THEMES = [
    {
      id: 'theme-ai',
      name: 'AI与产品',
      description: '关于 AI 产品、机会、差异化等方面的思考聚合',
      keywords: [
        'ai',
        'gpt',
        'chatgpt',
        'claude',
        '大模型',
        'llm',
        '产品',
        '模型',
        '智能',
        '机器学习',
        'openai',
        'copilot',
        'agent',
        '人工智能',
      ],
    },
    {
      id: 'theme-knowledge',
      name: '知识系统',
      description: '关于知识管理、第二大脑与信息组织的思考',
      keywords: [
        '知识',
        '笔记',
        '第二大脑',
        'obsidian',
        'notion',
        'roam',
        '卡片',
        '知识体系',
        '知识库',
        '整理',
      ],
    },
    {
      id: 'theme-workflow',
      name: '工作流',
      description: '关于流程、自动化与个人效率的思考',
      keywords: [
        '工作流',
        '流程',
        '自动化',
        '效率',
        'sop',
        'pipeline',
        'n8n',
        '习惯',
      ],
    },
    {
      id: 'theme-wealth',
      name: '财富与商业',
      description: '关于商业机会、财富积累与商业模式的思考',
      keywords: [
        '商业',
        '财富',
        '赚钱',
        '创业',
        '投资',
        '融资',
        '商业模式',
        '变现',
        '市场',
      ],
    },
    {
      id: 'theme-growth',
      name: '成长与思维',
      description: '关于长期主义、认知升级与思维方式的思考',
      keywords: [
        '成长',
        '思维',
        '认知',
        '长期',
        '反思',
        '学习',
        '心智',
        '原则',
      ],
    },
    {
      id: 'theme-writing',
      name: '写作与表达',
      description: '关于写作、表达与内容创作的思考',
      keywords: ['写作', '表达', '创作', '文章', '内容', '读者', 'publish'],
    },
    {
      id: 'theme-tools',
      name: '工具与技术',
      description: '关于开发工具、插件与工程技术的想法',
      keywords: [
        '工具',
        '技术',
        '开发',
        '插件',
        'chrome',
        '扩展',
        '代码',
        '编程',
        '软件',
        '浏览器',
        '谷歌',
      ],
    },
  ];

  const MISC_THEME = {
    id: 'theme-misc',
    name: '其他思考',
    description: '尚未归入明确主题星系的零散想法',
    keywords: [],
  };

  const ALL_THEMES = [...CANONICAL_THEMES, MISC_THEME];

  function recordText(record) {
    return [
      record.note,
      record.selectedText,
      record.pageTitle,
      record.pageUrl,
      ...(Array.isArray(record.tags) ? record.tags : []),
      ...(Array.isArray(record.keywords) ? record.keywords : []),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  /**
   * @param {object} record
   * @param {object} theme
   * @returns {number}
   */
  function scoreTheme(record, theme) {
    const text = recordText(record);
    if (!text) {
      return 0;
    }
    let score = 0;
    (theme.keywords || []).forEach((kw) => {
      const k = String(kw).toLowerCase();
      if (text.includes(k)) {
        score += k.length >= 3 ? 2 : 1;
      }
    });
    if (theme.name && text.includes(theme.name.toLowerCase())) {
      score += 4;
    }
    return score;
  }

  /**
   * @param {object} record
   * @returns {string} theme id
   */
  function assignThemeId(record) {
    let bestId = MISC_THEME.id;
    let bestScore = 0;
    CANONICAL_THEMES.forEach((theme) => {
      const s = scoreTheme(record, theme);
      if (s > bestScore) {
        bestScore = s;
        bestId = theme.id;
      }
    });
    return bestScore > 0 ? bestId : MISC_THEME.id;
  }

  function getThemeById(id) {
    return ALL_THEMES.find((t) => t.id === id) || MISC_THEME;
  }

  /**
   * @param {object[]} members
   * @param {number} limit
   * @returns {string[]}
   */
  function extractMemberKeywords(members, limit) {
    const freq = new Map();
    (members || []).forEach((record) => {
      const text = [
        record.note,
        record.selectedText,
        record.pageTitle,
      ]
        .filter(Boolean)
        .join('\n');
      if (
        typeof MindTraceKeywordService !== 'undefined' &&
        typeof MindTraceKeywordService.extractKeywords === 'function'
      ) {
        MindTraceKeywordService.extractKeywords(text).forEach((kw) => {
          if (kw && kw.length >= 2) {
            freq.set(kw, (freq.get(kw) || 0) + 1);
          }
        });
      }
      (record.keywords || []).forEach((kw) => {
        if (kw && kw.length >= 2) {
          freq.set(kw, (freq.get(kw) || 0) + 1);
        }
      });
    });
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 8)
      .map(([word]) => word);
  }

  /**
   * @param {object[]} thoughts
   * @returns {Array<{ clusterId: string, themeId: string, theme: string, description: string, keywords: string[], recordIds: string[], count: number }>}
   */
  function buildThemeMeta(thoughts) {
    if (!Array.isArray(thoughts) || !thoughts.length) {
      return [];
    }

    const groups = new Map();
    ALL_THEMES.forEach((t) => groups.set(t.id, []));

    thoughts.forEach((t) => {
      const tid = assignThemeId(t);
      if (!groups.has(tid)) {
        groups.set(tid, []);
      }
      groups.get(tid).push(t);
    });

    const meta = [];
    ALL_THEMES.forEach((def) => {
      const members = groups.get(def.id) || [];
      if (!members.length) {
        return;
      }
      const topKw = extractMemberKeywords(members, 6);
      meta.push({
        clusterId: def.id,
        themeId: def.id,
        theme: def.name,
        description: def.description,
        keywords: topKw.length ? topKw : [],
        recordIds: members.map((m) => m.id),
        count: members.length,
      });
    });

    meta.sort((a, b) => b.count - a.count);
    return meta;
  }

  /**
   * 记录在当前主题下的「子方向」——匹配其它标准主题星系名（设计稿第一圈）
   * @param {object} record
   * @param {string} parentThemeId
   * @returns {string}
   */
  function assignSecondaryThemeId(record, parentThemeId) {
    let bestId = MISC_THEME.id;
    let bestScore = 0;
    CANONICAL_THEMES.forEach((theme) => {
      if (theme.id === parentThemeId) {
        return;
      }
      const s = scoreTheme(record, theme);
      if (s > bestScore) {
        bestScore = s;
        bestId = theme.id;
      }
    });
    return bestId;
  }

  /**
   * 主题内的二级主题簇：按子方向（知识系统、工作流…）分组，单条兜底用语义簇
   * @param {string} themeId
   * @param {object[]} members
   * @param {Array} thoughtLinks
   */
  function buildSubClustersForTheme(themeId, members, thoughtLinks) {
    if (!members || !members.length) {
      return [];
    }

    const groups = new Map();
    members.forEach((m) => {
      const secId = assignSecondaryThemeId(m, themeId);
      const key = `${themeId}::${secId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(m);
    });

    const subMeta = [];
    groups.forEach((mems, key) => {
      const secId = key.split('::')[1] || MISC_THEME.id;
      const def = getThemeById(secId);
      let label = def.name;

      if (mems.length === 1 && secId === MISC_THEME.id) {
        const raw =
          typeof MindTraceGraphService !== 'undefined'
            ? MindTraceGraphService.extractLabel(mems[0])
            : (mems[0].note || '').slice(0, 12);
        label = raw.length > 10 ? `${raw.slice(0, 9)}…` : raw;
      }

      subMeta.push({
        subClusterId: key,
        themeId,
        secondaryThemeId: secId,
        label,
        recordIds: mems.map((m) => m.id),
        count: mems.length,
      });
    });

    subMeta.sort((a, b) => b.count - a.count);
    return subMeta;
  }

  /**
   * @param {Array} subClusters
   * @returns {Map<string, string>} thoughtId → subClusterId
   */
  function mapThoughtToSubCluster(subClusters) {
    const map = new Map();
    (subClusters || []).forEach((sc) => {
      (sc.recordIds || []).forEach((id) => map.set(id, sc.subClusterId));
    });
    return map;
  }

  /**
   * @param {object[]} thoughts
   * @returns {Map<string, string>}
   */
  function buildThoughtThemeMap(thoughts) {
    const map = new Map();
    (thoughts || []).forEach((t) => {
      if (t && t.id) {
        map.set(t.id, assignThemeId(t));
      }
    });
    return map;
  }

  /**
   * @param {Array} meta
   * @param {Array} thoughtLinks
   * @returns {Array<{ source: string, target: string, similarity: number, linkType: string }>}
   */
  function buildThemeLinks(meta, thoughtLinks) {
    const recordToTheme = new Map();
    meta.forEach((m) => {
      (m.recordIds || []).forEach((id) => recordToTheme.set(id, m.clusterId));
    });

    const pairStats = new Map();
    (thoughtLinks || []).forEach((link) => {
      const sId =
        typeof link.source === 'object' ? link.source.id : link.source;
      const tId =
        typeof link.target === 'object' ? link.target.id : link.target;
      const ts = recordToTheme.get(sId);
      const tt = recordToTheme.get(tId);
      if (!ts || !tt || ts === tt) {
        return;
      }
      const key = ts < tt ? `${ts}|${tt}` : `${tt}|${ts}`;
      const sim = link.similarity || 0.78;
      const prev = pairStats.get(key) || { sum: 0, n: 0 };
      prev.sum += sim;
      prev.n += 1;
      pairStats.set(key, prev);
    });

    const links = [];
    pairStats.forEach((stat, key) => {
      const [a, b] = key.split('|');
      links.push({
        source: `theme:${a}`,
        target: `theme:${b}`,
        similarity: Math.round((stat.sum / stat.n) * 100) / 100,
        linkType: 'theme',
      });
    });

    if (!links.length && meta.length > 1) {
      const hub = meta[0].clusterId;
      meta.slice(1).forEach((m) => {
        links.push({
          source: `theme:${hub}`,
          target: `theme:${m.clusterId}`,
          similarity: 0.5,
          linkType: 'theme',
        });
      });
    }

    return links;
  }

  /**
   * @param {Array} meta
   * @param {Array} thoughtLinks
   * @returns {(clusterId: string) => Array<{ clusterId: string, theme: string, score: number }>}
   */
  function buildThemeRelations(meta, thoughtLinks) {
    const recordToTheme = new Map();
    meta.forEach((m) => {
      (m.recordIds || []).forEach((id) => recordToTheme.set(id, m.clusterId));
    });

    const pairStats = new Map();
    (thoughtLinks || []).forEach((link) => {
      const sId =
        typeof link.source === 'object' ? link.source.id : link.source;
      const tId =
        typeof link.target === 'object' ? link.target.id : link.target;
      const c1 = recordToTheme.get(sId);
      const c2 = recordToTheme.get(tId);
      if (!c1 || !c2 || c1 === c2) {
        return;
      }
      const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
      const sim = link.similarity || 0.78;
      const prev = pairStats.get(key) || { sum: 0, n: 0 };
      prev.sum += sim;
      prev.n += 1;
      pairStats.set(key, prev);
    });

    return (clusterId) => {
      const scores = [];
      pairStats.forEach((stat, key) => {
        const [a, b] = key.split('|');
        let other = null;
        if (a === clusterId) {
          other = b;
        } else if (b === clusterId) {
          other = a;
        }
        if (!other) {
          return;
        }
        const theme = meta.find((m) => m.clusterId === other)?.theme;
        if (theme) {
          scores.push({
            clusterId: other,
            theme,
            score: Math.round((stat.sum / stat.n) * 100) / 100,
          });
        }
      });
      return scores.sort((x, y) => y.score - x.score).slice(0, 4);
    };
  }

  return {
    CANONICAL_THEMES,
    MISC_THEME,
    assignThemeId,
    assignSecondaryThemeId,
    getThemeById,
    buildThemeMeta,
    buildSubClustersForTheme,
    mapThoughtToSubCluster,
    buildThoughtThemeMap,
    buildThemeLinks,
    buildThemeRelations,
  };
})();
