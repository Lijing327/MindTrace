/**
 * MindTrace — 认知图谱（thoughts → nodes + semantic links）
 * Phase 4 预留：节点/边均带 createdAt，可据此做时间演化播放（本阶段不实现播放器）
 */

const MindTraceGraphService = (function () {
  'use strict';

  const SIMILARITY_THRESHOLD = 0.78;
  const RECENCY_HALF_LIFE_DAYS = 30;

  /**
   * 从 note 首行或 selectedText 提取展示标签
   * @param {InspirationRecord} thought
   * @returns {string}
   */
  function extractLabel(thought) {
    if (!thought) {
      return '（未命名思考）';
    }
    const note = (thought.note || '').trim();
    if (note) {
      const first = note.split('\n')[0].trim();
      if (first) {
        return first.length > 72 ? first.slice(0, 72) + '…' : first;
      }
    }
    const selected = (thought.selectedText || '').trim();
    if (selected) {
      return selected.length > 72 ? selected.slice(0, 72) + '…' : selected;
    }
    return '（未命名思考）';
  }

  /**
   * 两两语义相似度建边（需 embedding）
   * @param {InspirationRecord[]} thoughts
   * @returns {Array<{ source: string, target: string, similarity: number, createdAt: number, semantic?: boolean }>}
   */
  function buildSemanticLinks(thoughts) {
    const withEmb = thoughts.filter(
      (t) => Array.isArray(t.embedding) && t.embedding.length > 0
    );
    const links = [];

    for (let i = 0; i < withEmb.length; i++) {
      for (let j = i + 1; j < withEmb.length; j++) {
        const a = withEmb[i];
        const b = withEmb[j];
        if (
          typeof MindTraceGardenService !== 'undefined' &&
          !MindTraceGardenService.sameGarden(a, b)
        ) {
          continue;
        }
        const similarity = MindTraceVectorService.cosineSimilarity(
          a.embedding,
          b.embedding
        );

        if (similarity > SIMILARITY_THRESHOLD) {
          links.push({
            source: a.id,
            target: b.id,
            similarity,
            /** 边形成时间近似为较晚那条思考的创建时刻（Phase 4 演化轴） */
            createdAt: Math.max(a.createdAt, b.createdAt),
            semantic: true,
          });
        }
      }
    }

    return links;
  }

  /**
   * 关键词重叠建边（语义模型不可用时的降级）
   * @param {InspirationRecord[]} thoughts
   * @returns {Array<{ source: string, target: string, similarity: number, createdAt: number, semantic: boolean }>}
   */
  function buildKeywordLinks(thoughts) {
    if (
      typeof MindTraceSimilarityService === 'undefined' ||
      typeof MindTraceSimilarityService.calculateSimilarity !== 'function'
    ) {
      return [];
    }

    const links = [];

    for (let i = 0; i < thoughts.length; i++) {
      for (let j = i + 1; j < thoughts.length; j++) {
        const a = thoughts[i];
        const b = thoughts[j];
        if (
          typeof MindTraceGardenService !== 'undefined' &&
          !MindTraceGardenService.sameGarden(a, b)
        ) {
          continue;
        }
        const score = MindTraceSimilarityService.calculateSimilarity(a, b);
        if (score < 1) {
          continue;
        }

        links.push({
          source: a.id,
          target: b.id,
          similarity: Math.min(1, SIMILARITY_THRESHOLD + score * 0.04),
          createdAt: Math.max(a.createdAt, b.createdAt),
          semantic: false,
        });
      }
    }

    return links;
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @returns {Array<{ source: string, target: string, similarity: number, createdAt: number, semantic?: boolean }>}
   */
  function buildLinks(thoughts) {
    const semanticLinks = buildSemanticLinks(thoughts);
    if (semanticLinks.length) {
      return semanticLinks;
    }
    return buildKeywordLinks(thoughts);
  }

  /**
   * @param {string[]} thoughtIds
   * @param {Array<{ source: string, target: string }>} links
   * @returns {Map<string, number>}
   */
  function computeDegreeMap(thoughtIds, links) {
    const degree = new Map();
    thoughtIds.forEach((id) => degree.set(id, 0));
    links.forEach((link) => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      degree.set(s, (degree.get(s) || 0) + 1);
      degree.set(t, (degree.get(t) || 0) + 1);
    });
    return degree;
  }

  /**
   * weight = 基础 + 关联度 + 近期活跃 + 归一化中心性
   * @param {InspirationRecord} thought
   * @param {number} deg
   * @param {number} maxDegree
   * @param {number} now
   * @returns {number}
   */
  function computeNodeWeight(thought, deg, maxDegree, now) {
    const degreeNorm = maxDegree > 0 ? deg / maxDegree : 0;
    const ageDays = Math.max(0, (now - thought.createdAt) / (24 * 60 * 60 * 1000));
    const recency =
      RECENCY_HALF_LIFE_DAYS > 0
        ? Math.exp((-ageDays * Math.LN2) / RECENCY_HALF_LIFE_DAYS)
        : 1;

    const relationPart = deg * 0.35;
    const recencyPart = recency * 0.45;
    const centralityPart = degreeNorm * 0.55;

    return Math.max(1, 1 + relationPart + recencyPart + centralityPart);
  }

  /**
   * Phase 4：按时间戳截取子图（演化播放 API，暂未接 UI）
   * @param {{ nodes: object[], links: object[] }} graph
   * @param {number} timestamp 截至该时刻（含）
   * @returns {{ nodes: object[], links: object[] }}
   */
  function filterGraphByTime(graph, timestamp) {
    if (!graph || !Number.isFinite(timestamp)) {
      return { nodes: [], links: [] };
    }
    const nodes = (graph.nodes || []).filter(
      (n) => n.createdAt <= timestamp
    );
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (graph.links || []).filter((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return (
        l.createdAt <= timestamp && nodeIds.has(s) && nodeIds.has(t)
      );
    });
    return { nodes, links };
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @returns {{ nodes: object[], links: object[] }}
   */
  function buildGraph(thoughts) {
    if (!Array.isArray(thoughts) || !thoughts.length) {
      return { nodes: [], links: [] };
    }

    const now = Date.now();
    const links = buildLinks(thoughts);
    const thoughtIds = thoughts.map((t) => t.id);
    const degreeMap = computeDegreeMap(thoughtIds, links);
    const maxDegree = Math.max(0, ...degreeMap.values());

    const clusterMap =
      typeof MindTraceClusterService !== 'undefined' &&
      typeof MindTraceClusterService.assignClusters === 'function'
        ? MindTraceClusterService.assignClusters(thoughts, links)
        : new Map(thoughtIds.map((id) => [id, 'cluster-0']));

    const clusterThemeMap = new Map();
    if (
      typeof MindTraceClusterService !== 'undefined' &&
      typeof MindTraceClusterService.buildClusterMeta === 'function'
    ) {
      MindTraceClusterService.buildClusterMeta(thoughts, links).forEach(
        (meta) => {
          clusterThemeMap.set(meta.clusterId, meta.theme);
        }
      );
    }

    const nodes = thoughts.map((thought) => {
      const deg = degreeMap.get(thought.id) || 0;
      const clusterId = clusterMap.get(thought.id) || 'cluster-0';
      return {
        id: thought.id,
        label: extractLabel(thought),
        createdAt: thought.createdAt,
        weight: computeNodeWeight(thought, deg, maxDegree, now),
        cluster: clusterId,
        clusterLabel: clusterThemeMap.get(clusterId) || clusterId,
        degree: deg,
      };
    });

    return { nodes, links };
  }

  return {
    buildGraph,
    extractLabel,
    filterGraphByTime,
    SIMILARITY_THRESHOLD,
  };
})();
