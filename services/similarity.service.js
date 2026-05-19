/**
 * MindTrace — 关键词重叠相似度（纯本地）
 */

const MindTraceSimilarityService = (function () {
  'use strict';

  /**
   * 比较两条记录的 keywords，每命中一个关键词 score +1
   * @param {{ keywords?: string[] }} recordA
   * @param {{ keywords?: string[] }} recordB
   * @returns {number}
   */
  function calculateSimilarity(recordA, recordB) {
    const kwA = Array.isArray(recordA && recordA.keywords)
      ? recordA.keywords
      : [];
    const kwB = Array.isArray(recordB && recordB.keywords)
      ? recordB.keywords
      : [];

    if (!kwA.length || !kwB.length) {
      return 0;
    }

    const setB = new Set(
      kwB.map((k) => String(k).toLowerCase())
    );

    let score = 0;
    kwA.forEach((keyword) => {
      if (setB.has(String(keyword).toLowerCase())) {
        score += 1;
      }
    });

    return score;
  }

  return {
    calculateSimilarity,
  };
})();
