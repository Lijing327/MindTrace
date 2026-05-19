/**
 * MindTrace — 主题聚类
 * MVP：基于语义连边的连通分量分配 cluster id，为「主题星系」预留 API
 */

const MindTraceClusterService = (function () {
  'use strict';

  /**
   * 并查集：根据 links 划分连通分量
   * @param {string[]} thoughtIds
   * @param {Array<{ source: string, target: string }>} links
   * @returns {Map<string, string>} thoughtId → cluster id
   */
  function assignClusters(thoughts, links) {
    const thoughtIds = (thoughts || []).map((t) => t.id).filter(Boolean);
    const parent = new Map();

    thoughtIds.forEach((id) => parent.set(id, id));

    function find(x) {
      let root = parent.get(x);
      if (root === undefined) {
        return x;
      }
      if (root !== x) {
        root = find(root);
        parent.set(x, root);
      }
      return root;
    }

    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) {
        parent.set(ra, rb);
      }
    }

    (links || []).forEach((link) => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s && t && parent.has(s) && parent.has(t)) {
        union(s, t);
      }
    });

    const rootToCluster = new Map();
    let clusterIdx = 0;
    const idToCluster = new Map();

    thoughtIds.forEach((id) => {
      const root = find(id);
      if (!rootToCluster.has(root)) {
        rootToCluster.set(root, `cluster-${clusterIdx}`);
        clusterIdx += 1;
      }
      idToCluster.set(id, rootToCluster.get(root));
    });

    return idToCluster;
  }

  /**
   * 未来：基于 embedding 的主题命名聚类
   * @param {InspirationRecord[]} records
   * @returns {Array<{ theme: string, recordIds: string[], clusterId: string }>}
   */
  function clusterByTheme(records) {
    if (!Array.isArray(records) || !records.length) {
      return [];
    }

    const links = [];
    const withEmb = records.filter(
      (r) => Array.isArray(r.embedding) && r.embedding.length > 0
    );

    for (let i = 0; i < withEmb.length; i++) {
      for (let j = i + 1; j < withEmb.length; j++) {
        const sim = MindTraceVectorService.cosineSimilarity(
          withEmb[i].embedding,
          withEmb[j].embedding
        );
        const threshold =
          typeof MindTraceRelationService !== 'undefined'
            ? MindTraceRelationService.SEMANTIC_THRESHOLD
            : 0.78;
        if (sim > threshold) {
          links.push({ source: withEmb[i].id, target: withEmb[j].id });
        }
      }
    }

    const clusterMap = assignClusters(records, links);
    const groups = new Map();

    records.forEach((r) => {
      const cid = clusterMap.get(r.id) || 'cluster-0';
      if (!groups.has(cid)) {
        groups.set(cid, []);
      }
      groups.get(cid).push(r.id);
    });

    return [...groups.entries()].map(([clusterId, recordIds]) => ({
      clusterId,
      theme: clusterId,
      recordIds,
    }));
  }

  return {
    assignClusters,
    clusterByTheme,
  };
})();
