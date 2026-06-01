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

  const THEME_STOPWORDS = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
    '好', '自己', '这', '那', '什么', '怎么', '可以', '这个', '那个', '已经',
    '因为', '所以', '如果', '但是', '或者', '以及', '还有', '就是', '而且',
  ]);

  /**
   * @param {InspirationRecord[]} members
   * @returns {string}
   */
  function labelCluster(members) {
    const freq = new Map();
    (members || []).forEach((record) => {
      const text = [record.note, record.selectedText, record.pageTitle]
        .filter(Boolean)
        .join('\n');
      if (typeof MindTraceKeywordService !== 'undefined') {
        MindTraceKeywordService.extractKeywords(text).forEach((kw) => {
          if (kw && !THEME_STOPWORDS.has(kw)) {
            freq.set(kw, (freq.get(kw) || 0) + 1);
          }
        });
      }
      (record.keywords || []).forEach((kw) => {
        if (kw && !THEME_STOPWORDS.has(kw)) {
          freq.set(kw, (freq.get(kw) || 0) + 1);
        }
      });
    });

    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    if (!top.length) {
      const n = (members || []).length;
      return n > 1 ? `主题星系 · ${n} 条` : '独立星点';
    }
    if (top.length === 1) {
      return top[0];
    }
    return top.slice(0, 2).join(' · ');
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {Array<{ source: string, target: string }>} links
   * @returns {Array<{ clusterId: string, theme: string, recordIds: string[], count: number }>}
   */
  function buildClusterMeta(thoughts, links) {
    if (!Array.isArray(thoughts) || !thoughts.length) {
      return [];
    }

    const clusterMap = assignClusters(thoughts, links);
    const groups = new Map();

    thoughts.forEach((t) => {
      const cid = clusterMap.get(t.id) || 'cluster-0';
      if (!groups.has(cid)) {
        groups.set(cid, []);
      }
      groups.get(cid).push(t);
    });

    const meta = [];
    groups.forEach((members, clusterId) => {
      meta.push({
        clusterId,
        theme: labelCluster(members),
        recordIds: members.map((m) => m.id),
        count: members.length,
      });
    });

    meta.sort((a, b) => b.count - a.count);
    return meta;
  }

  /**
   * 基于 embedding 连边的主题聚类（含可读主题名）
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

    const thoughtById = new Map(records.map((r) => [r.id, r]));

    return [...groups.entries()].map(([clusterId, recordIds]) => {
      const members = recordIds
        .map((id) => thoughtById.get(id))
        .filter(Boolean);
      return {
        clusterId,
        theme: labelCluster(members),
        recordIds,
      };
    });
  }

  return {
    assignClusters,
    labelCluster,
    buildClusterMeta,
    clusterByTheme,
  };
})();
