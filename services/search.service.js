/**
 * MindTrace — 搜索（关键词 + 本地语义相似）
 */

const MindTraceSearchService = (function () {
  'use strict';

  const SEMANTIC_MIN_QUERY_LEN = 2;
  const SEMANTIC_MIN_SCORE = 0.42;
  const SEMANTIC_TOP_N = 80;

  /**
   * @param {string} query
   * @param {InspirationRecord[]} items
   * @returns {InspirationRecord[]}
   */
  function keywordSearch(query, items) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return items || [];
    }
    return (items || []).filter((item) => {
      const fields = [
        item.selectedText,
        item.note,
        item.pageTitle,
        item.pageUrl,
        ...(item.keywords || []),
        ...(item.tags || []),
      ];
      return fields.some(
        (f) => f && String(f).toLowerCase().includes(q)
      );
    });
  }

  /**
   * @param {string} query
   * @param {InspirationRecord[]} items
   * @returns {Promise<Array<{ item: InspirationRecord, score: number }>>}
   */
  async function semanticRank(query, items) {
    if (
      typeof MindTraceEmbeddingService === 'undefined' ||
      typeof MindTraceVectorService === 'undefined'
    ) {
      return [];
    }

    const q = (query || '').trim();
    if (q.length < SEMANTIC_MIN_QUERY_LEN) {
      return [];
    }

    let queryEmb = null;
    try {
      queryEmb = await MindTraceEmbeddingService.getEmbedding(q);
    } catch (err) {
      console.warn('[MindTrace] semantic search embed failed:', err);
      return [];
    }

    if (!Array.isArray(queryEmb) || !queryEmb.length) {
      return [];
    }

    const scored = [];
    (items || []).forEach((item) => {
      const emb = item.embedding;
      if (!Array.isArray(emb) || !emb.length) {
        return;
      }
      const score = MindTraceVectorService.cosineSimilarity(queryEmb, emb);
      if (score >= SEMANTIC_MIN_SCORE) {
        scored.push({ item, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, SEMANTIC_TOP_N);
  }

  /**
   * @param {string} query
   * @param {string|null} gardenId
   * @returns {Promise<{ items: InspirationRecord[], mode: 'none'|'keyword'|'semantic'|'hybrid' }>}
   */
  async function search(query, gardenId) {
    const items = await MindTraceStorage.getAll(gardenId);
    const q = (query || '').trim();
    if (!q) {
      return { items, mode: 'none' };
    }

    const keywordHits = keywordSearch(q, items);
    const keywordIds = new Set(keywordHits.map((i) => i.id));

    if (q.length < SEMANTIC_MIN_QUERY_LEN) {
      return { items: keywordHits, mode: 'keyword' };
    }

    const semanticHits = await semanticRank(q, items);
    if (!semanticHits.length) {
      return { items: keywordHits, mode: 'keyword' };
    }

    const merged = [];
    const seen = new Set();

    semanticHits.forEach(({ item }) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    });

    keywordHits.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    });

    const mode =
      semanticHits.length && keywordIds.size ? 'hybrid' : 'semantic';

    return { items: merged, mode };
  }

  return {
    keywordSearch,
    semanticRank,
    search,
    SEMANTIC_MIN_SCORE,
  };
})();
