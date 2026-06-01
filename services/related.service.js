/**
 * MindTrace — 相关思考引擎（标题 + 标签 + 关键词，Top 5）
 */

const MindTraceRelatedService = (function () {
  'use strict';

  const TOP_N = 5;
  const WEIGHT_TITLE = 0.38;
  const WEIGHT_TAGS = 0.34;
  const WEIGHT_KEYWORDS = 0.23;
  const WEIGHT_SEMANTIC = 0.05;
  const MIN_SCORE = 0.18;

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function titleOf(record) {
    if (typeof MindTraceTagService !== 'undefined') {
      return MindTraceTagService.extractTitle(record);
    }
    const note = (record.note || '').trim();
    if (note) {
      return note.split('\n')[0].trim();
    }
    return (record.selectedText || record.pageTitle || '').trim();
  }

  /**
   * @param {string} text
   * @returns {Set<string>}
   */
  function tokenize(text) {
    const set = new Set();
    const t = (text || '').toLowerCase();
    const cn = t.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    cn.forEach((w) => set.add(w));
    const en = t.match(/[a-z0-9]{2,}/g) || [];
    en.forEach((w) => set.add(w));
    return set;
  }

  /**
   * @param {Set<string>} a
   * @param {Set<string>} b
   * @returns {number}
   */
  function jaccard(a, b) {
    if (!a.size || !b.size) {
      return 0;
    }
    let inter = 0;
    a.forEach((x) => {
      if (b.has(x)) {
        inter += 1;
      }
    });
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
  }

  /**
   * @param {string[]} listA
   * @param {string[]} listB
   * @returns {number}
   */
  function listOverlap(listA, listB) {
    if (!listA.length || !listB.length) {
      return 0;
    }
    const b = new Set(listB.map((x) => String(x).toLowerCase()));
    let hit = 0;
    listA.forEach((x) => {
      if (b.has(String(x).toLowerCase())) {
        hit += 1;
      }
    });
    return hit / Math.max(listA.length, listB.length);
  }

  /**
   * @param {InspirationRecord} a
   * @param {InspirationRecord} b
   * @returns {number}
   */
  function titleSimilarity(a, b) {
    return jaccard(tokenize(titleOf(a)), tokenize(titleOf(b)));
  }

  /**
   * @param {InspirationRecord} a
   * @param {InspirationRecord} b
   * @returns {number}
   */
  function tagSimilarity(a, b) {
    const tagsA = Array.isArray(a.tags) ? a.tags : [];
    const tagsB = Array.isArray(b.tags) ? b.tags : [];
    return listOverlap(tagsA, tagsB);
  }

  /**
   * @param {InspirationRecord} a
   * @param {InspirationRecord} b
   * @returns {number}
   */
  function keywordSimilarity(a, b) {
    if (typeof MindTraceSimilarityService === 'undefined') {
      return 0;
    }
    const raw = MindTraceSimilarityService.calculateSimilarity(a, b);
    const maxKw = Math.max(
      (a.keywords || []).length,
      (b.keywords || []).length,
      1
    );
    return Math.min(1, raw / maxKw);
  }

  /**
   * @param {InspirationRecord} a
   * @param {InspirationRecord} b
   * @returns {number}
   */
  function semanticSimilarity(a, b) {
    const embA = a.embedding;
    const embB = b.embedding;
    if (
      !Array.isArray(embA) ||
      !embA.length ||
      !Array.isArray(embB) ||
      !embB.length ||
      typeof MindTraceVectorService === 'undefined'
    ) {
      return 0;
    }
    const sim = MindTraceVectorService.cosineSimilarity(embA, embB);
    return sim > 0.55 ? sim : 0;
  }

  /**
   * @param {InspirationRecord} current
   * @param {InspirationRecord} other
   * @returns {number}
   */
  function combinedScore(current, other) {
    const title = titleSimilarity(current, other);
    const tags = tagSimilarity(current, other);
    const kw = keywordSimilarity(current, other);
    const sem = semanticSimilarity(current, other);
    return (
      title * WEIGHT_TITLE +
      tags * WEIGHT_TAGS +
      kw * WEIGHT_KEYWORDS +
      sem * WEIGHT_SEMANTIC
    );
  }

  /**
   * @param {InspirationRecord} currentRecord
   * @param {InspirationRecord[]} allRecords
   * @returns {Array<{ id: string, score: number, record: InspirationRecord }>}
   */
  function findRelated(currentRecord, allRecords) {
    if (!currentRecord || !Array.isArray(allRecords)) {
      return [];
    }

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
      const score = combinedScore(currentRecord, other);
      if (score >= MIN_SCORE) {
        results.push({ id: other.id, score, record: other });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, TOP_N);
  }

  /**
   * @param {InspirationRecord} currentRecord
   * @param {InspirationRecord[]} allRecords
   * @returns {string[]}
   */
  function assignRelatedIds(currentRecord, allRecords) {
    return findRelated(currentRecord, allRecords).map((r) => r.id);
  }

  /**
   * @param {InspirationRecord} current
   * @param {InspirationRecord[]} allRecords
   * @returns {Array<{ record: InspirationRecord, score: number, semantic: boolean }>}
   */
  function toRelationView(current, allRecords) {
    const byId = new Map(allRecords.map((r) => [r.id, r]));
    const ids = Array.isArray(current.relatedIds) ? current.relatedIds : [];
    if (ids.length) {
      return ids
        .map((id) => {
          const record = byId.get(id);
          if (!record) {
            return null;
          }
          return {
            record,
            score: combinedScore(current, record),
            semantic: semanticSimilarity(current, record) > 0.7,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
    }
    return findRelated(current, allRecords).map((r) => ({
      record: r.record,
      score: r.score,
      semantic: r.score >= 0.65,
    }));
  }

  return {
    TOP_N,
    findRelated,
    assignRelatedIds,
    combinedScore,
    toRelationView,
  };
})();
