/**
 * MindTrace — 阅读来源聚合（页面 / 站点 / 书名）
 */

const MindTraceSourceService = (function () {
  'use strict';

  /**
   * @param {string} url
   * @returns {string}
   */
  function hostnameFromUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch (_e) {
      return '';
    }
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function resolveSourceLabel(record) {
    const title = (record.pageTitle || '').trim();
    if (title && title !== '未知页面') {
      return title;
    }
    const host = hostnameFromUrl(record.pageUrl || '');
    return host || '未标注来源';
  }

  /**
   * @param {InspirationRecord} record
   * @returns {string}
   */
  function resolveSourceKey(record) {
    const label = resolveSourceLabel(record);
    const host = hostnameFromUrl(record.pageUrl || '');
    return `${host}::${label}`;
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string} [gardenId]
   * @returns {Array<{ key: string, title: string, host: string, url: string, count: number, recordIds: string[], latestAt: number }>}
   */
  function buildSourceGroups(thoughts, gardenId) {
    const groups = new Map();

    (thoughts || []).forEach((record) => {
      if (!record || !record.id) {
        return;
      }
      if (gardenId && typeof MindTraceGardenService !== 'undefined') {
        const gid = MindTraceGardenService.resolveGardenId(record);
        if (gid !== gardenId) {
          return;
        }
      }

      const key = resolveSourceKey(record);
      const title = resolveSourceLabel(record);
      const host = hostnameFromUrl(record.pageUrl || '');
      const url = record.pageUrl || '';
      const ts = Math.max(record.updatedAt || 0, record.createdAt || 0);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          host,
          url,
          count: 0,
          recordIds: [],
          latestAt: 0,
        });
      }
      const g = groups.get(key);
      g.count += 1;
      g.recordIds.push(record.id);
      if (ts > g.latestAt) {
        g.latestAt = ts;
        g.url = url || g.url;
      }
    });

    return [...groups.values()].sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
  }

  return {
    resolveSourceLabel,
    resolveSourceKey,
    buildSourceGroups,
    hostnameFromUrl,
  };
})();
