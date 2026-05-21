/**
 * MindTrace — 历史思考关联（语义向量优先，关键词降级）
 */

const MindTraceRelationService = (function () {
  'use strict';

  const SEMANTIC_THRESHOLD = 0.78;
  const TOP_N = 3;

  /**
   * @param {InspirationRecord} currentRecord
   * @param {InspirationRecord[]} allRecords
   * @returns {Array<{ record: InspirationRecord, score: number, semantic: boolean }>}
   */
  function findRelatedThoughts(currentRecord, allRecords) {
    if (!currentRecord || !Array.isArray(allRecords) || !allRecords.length) {
      return [];
    }

    const currentEmb = currentRecord.embedding;
    if (Array.isArray(currentEmb) && currentEmb.length > 0) {
      const semantic = findBySemantic(currentRecord, allRecords, currentEmb);
      if (semantic.length) {
        return semantic;
      }
    }

    return findByKeywordFallback(currentRecord, allRecords);
  }

  /**
   * @param {InspirationRecord} currentRecord
   * @param {InspirationRecord[]} allRecords
   * @param {number[]} currentEmb
   * @returns {Array<{ record: InspirationRecord, score: number, semantic: boolean }>}
   */
  function findBySemantic(currentRecord, allRecords, currentEmb) {
    const results = [];

    allRecords.forEach((other) => {
      if (!other || other.id === currentRecord.id) {
        return;
      }
      if (
        typeof MindTraceGardenService !== 'undefined' &&
        !MindTraceGardenService.sameGarden(currentRecord, other)
      ) {
        return;
      }

      const otherEmb = other.embedding;
      if (!Array.isArray(otherEmb) || !otherEmb.length) {
        return;
      }

      const score = MindTraceVectorService.cosineSimilarity(
        currentEmb,
        otherEmb
      );

      if (score > SEMANTIC_THRESHOLD) {
        results.push({ record: other, score, semantic: true });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, TOP_N);
  }

  /**
   * @param {InspirationRecord} currentRecord
   * @param {InspirationRecord[]} allRecords
   * @returns {Array<{ record: InspirationRecord, score: number, semantic: boolean }>}
   */
  function findByKeywordFallback(currentRecord, allRecords) {
    const results = [];

    allRecords.forEach((other) => {
      if (!other || other.id === currentRecord.id) {
        return;
      }
      if (
        typeof MindTraceGardenService !== 'undefined' &&
        !MindTraceGardenService.sameGarden(currentRecord, other)
      ) {
        return;
      }

      const raw = MindTraceSimilarityService.calculateSimilarity(
        currentRecord,
        other
      );

      if (raw > 0) {
        results.push({
          record: other,
          score: raw,
          semantic: false,
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, TOP_N);
  }

  return {
    findRelatedThoughts,
    SEMANTIC_THRESHOLD,
  };
})();
