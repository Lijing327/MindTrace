/**
 * MindTrace — 关键词提取（纯本地规则，无 AI）
 */

const MindTraceKeywordService = (function () {
  'use strict';

  const STOPWORDS = new Set([
    '这个',
    '那个',
    '我们',
    '你们',
    '自己',
    '时候',
    '问题',
    '事情',
    '东西',
  ]);

  /**
   * 从文本提取 2~4 字中文短词与英文单词
   * @param {string} text
   * @returns {string[]}
   */
  function extractKeywords(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const rawTokens = [];

    const chineseRe = /[\u4e00-\u9fa5]{2,4}/g;
    let match;
    while ((match = chineseRe.exec(text)) !== null) {
      rawTokens.push(match[0]);
    }

    const englishRe = /[a-zA-Z][a-zA-Z0-9]*/g;
    let enMatch;
    while ((enMatch = englishRe.exec(text)) !== null) {
      rawTokens.push(enMatch[0].toLowerCase());
    }

    const seen = new Set();
    const result = [];

    rawTokens.forEach((token) => {
      if (!token || STOPWORDS.has(token)) {
        return;
      }
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      result.push(token);
    });

    return result;
  }

  return {
    extractKeywords,
  };
})();
