/**
 * MindTrace — 认知标签（本地规则优先，预留 LLM）
 * 保存后根据标题 / 原文 / 想法生成 3~5 个主题标签
 */

const MindTraceTagService = (function () {
  'use strict';

  const MIN_TAGS = 3;
  const MAX_TAGS = 5;

  /** @type {Array<{ tag: string, keywords: string[], weight?: number }>} */
  const TAG_RULES = [
    {
      tag: 'AI产品',
      keywords: [
        'ai', 'gpt', 'chatgpt', 'claude', '大模型', 'llm', '产品', 'agent',
        'copilot', 'openai', '人工智能', '智能', '模型', '赛道',
      ],
      weight: 1.1,
    },
    {
      tag: '商业模式',
      keywords: [
        '商业', '模式', '变现', '盈利', 'saas', '订阅', '付费', '客户',
        '市场', '竞品', 'mvp', '产品化', '运营',
      ],
    },
    {
      tag: '财富自由',
      keywords: [
        '财富', '自由', '财务自由', '投资', '资产', '被动收入', '复利',
        '理财', '现金流', '纳瓦尔',
      ],
    },
    {
      tag: '卖铲子逻辑',
      keywords: [
        '铲子', '卖铲', '工具', '基础设施', '平台', '生态', '赋能',
        '卖水', '淘金', '产业链',
      ],
    },
    {
      tag: '知识系统',
      keywords: [
        '知识', '第二大脑', '笔记', 'obsidian', 'notion', '卡片', '体系',
        '方法论', '复盘', '沉淀',
      ],
    },
    {
      tag: '工作流',
      keywords: [
        '工作流', '流程', '自动化', '效率', '协作', 'sop', '习惯',
        '时间管理', '任务',
      ],
    },
    {
      tag: '成长与思维',
      keywords: [
        '成长', '思维', '认知', '心智', '反思', '长期主义', '第一性',
        '能力圈', '格局', '心态',
      ],
    },
    {
      tag: '写作与表达',
      keywords: [
        '写作', '表达', '输出', '文章', '内容', '创作', '故事', '文案',
      ],
    },
    {
      tag: '工具与技术',
      keywords: [
        '技术', '代码', '开发', '编程', '软件', '插件', 'chrome', 'api',
        '工程', '架构',
      ],
    },
    {
      tag: '阅读与来源',
      keywords: ['阅读', '书籍', '章节', '摘录', '划线', '宝典', '文章'],
    },
    {
      tag: '个人IP',
      keywords: ['ip', '品牌', '影响力', '自媒体', '粉丝', '定位'],
    },
  ];

  /**
   * 未来 LLM 标签：返回 null 表示未启用，走本地规则
   * @param {InspirationRecord} record
   * @param {{ apiKey?: string, endpoint?: string }} [options]
   * @returns {Promise<string[]|null>}
   */
  async function generateTagsViaLLM(record, options) {
    void record;
    void options;
    return null;
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function extractTitle(record) {
    const note = (record.note || '').trim();
    if (note) {
      return note.split('\n')[0].trim();
    }
    const sel = (record.selectedText || '').trim();
    if (sel) {
      return sel.length > 80 ? `${sel.slice(0, 79)}…` : sel;
    }
    return (record.pageTitle || '').trim();
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function getCompositeText(record) {
    return [
      extractTitle(record),
      record.selectedText,
      record.note,
      record.pageTitle,
      ...(Array.isArray(record.keywords) ? record.keywords : []),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  /**
   * @param {string} text
   * @param {{ tag: string, keywords: string[], weight?: number }} rule
   * @returns {number}
   */
  function scoreRule(text, rule) {
    let score = 0;
    (rule.keywords || []).forEach((kw) => {
      const k = String(kw).toLowerCase();
      if (!k) {
        return;
      }
      if (text.includes(k)) {
        score += k.length >= 4 ? 3 : k.length >= 2 ? 2 : 1;
      }
    });
    if (rule.tag && text.includes(rule.tag.toLowerCase())) {
      score += 4;
    }
    return score * (rule.weight || 1);
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string[]}
   */
  function generateTagsLocal(record) {
    const text = getCompositeText(record);
    if (!text.trim()) {
      return [];
    }

    const ranked = TAG_RULES.map((rule) => ({
      tag: rule.tag,
      score: scoreRule(text, rule),
    }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    const tags = [];
    const seen = new Set();
    ranked.forEach(({ tag }) => {
      if (tags.length >= MAX_TAGS) {
        return;
      }
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    });

    if (tags.length < MIN_TAGS && typeof MindTraceKeywordService !== 'undefined') {
      const kws = MindTraceKeywordService.extractKeywords(text).slice(0, 8);
      kws.forEach((kw) => {
        if (tags.length >= MAX_TAGS) {
          return;
        }
        const normalized =
          kw.length >= 2 && kw.length <= 8 ? kw : null;
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          tags.push(normalized);
        }
      });
    }

    return tags.slice(0, MAX_TAGS);
  }

  /**
   * @param {InspirationRecord} record
   * @param {{ useLLM?: boolean, llmOptions?: object }} [options]
   * @returns {Promise<string[]>}
   */
  async function generateTags(record, options) {
    if (options && options.useLLM) {
      const fromLlm = await generateTagsViaLLM(record, options.llmOptions);
      if (Array.isArray(fromLlm) && fromLlm.length) {
        return fromLlm.slice(0, MAX_TAGS);
      }
    }
    return generateTagsLocal(record);
  }

  /**
   * 同步生成（存储层 save 使用）
   * @param {InspirationRecord} record
   * @returns {string[]}
   */
  function assignTags(record) {
    return generateTagsLocal(record);
  }

  return {
    TAG_RULES,
    MIN_TAGS,
    MAX_TAGS,
    extractTitle,
    generateTagsLocal,
    generateTags,
    generateTagsViaLLM,
    assignTags,
  };
})();
