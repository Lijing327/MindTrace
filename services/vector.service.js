/**
 * MindTrace — 向量运算（余弦相似度）
 */

const MindTraceVectorService = (function () {
  'use strict';

  /**
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number} 0~1（已归一化向量时即为 cosine）
   */
  function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
      return 0;
    }

    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      const x = a[i];
      const y = b[i];
      dot += x * y;
      normA += x * x;
      normB += y * y;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    if (sim < 0) {
      return 0;
    }
    if (sim > 1) {
      return 1;
    }
    return sim;
  }

  return {
    cosineSimilarity,
  };
})();
