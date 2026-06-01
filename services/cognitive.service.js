/**
 * MindTrace — 认知成长分析（7 / 30 / 90 天）
 */

const MindTraceCognitiveService = (function () {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOWS = [7, 30, 90];

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {number} days
   * @returns {InspirationRecord[]}
   */
  function filterWindow(thoughts, days) {
    const since = Date.now() - days * DAY_MS;
    return (thoughts || []).filter((t) => (t.createdAt || 0) >= since);
  }

  /**
   * @param {InspirationRecord[]} items
   * @returns {Map<string, number>}
   */
  function countTagFreq(items) {
    const freq = new Map();
    (items || []).forEach((item) => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      tags.forEach((tag) => {
        const t = String(tag).trim();
        if (t) {
          freq.set(t, (freq.get(t) || 0) + 1);
        }
      });
    });
    return freq;
  }

  /**
   * @param {Map<string, number>} freq
   * @param {number} limit
   * @returns {Array<{ tag: string, count: number }>}
   */
  function topFromFreq(freq, limit) {
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * @param {InspirationRecord[]} thoughts
   * @param {string} [gardenId]
   * @returns {object}
   */
  function buildInsights(thoughts, gardenId) {
    let list = thoughts || [];
    if (gardenId && typeof MindTraceGardenService !== 'undefined') {
      list = list.filter(
        (t) => MindTraceGardenService.resolveGardenId(t) === gardenId
      );
    }

    const windows = {};
    WINDOWS.forEach((days) => {
      const recent = filterWindow(list, days);
      const prior = list.filter((t) => {
        const ts = t.createdAt || 0;
        return ts >= Date.now() - days * 2 * DAY_MS && ts < Date.now() - days * DAY_MS;
      });

      const recentFreq = countTagFreq(recent);
      const priorFreq = countTagFreq(prior);
      const topThemes = topFromFreq(recentFreq, 6);

      const newThemes = topThemes
        .filter(({ tag }) => !priorFreq.has(tag))
        .map(({ tag }) => tag);

      const growing = topThemes
        .filter(({ tag, count }) => {
          const prev = priorFreq.get(tag) || 0;
          return count > prev && count >= 2;
        })
        .map(({ tag, count }) => ({
          tag,
          count,
          delta: count - (priorFreq.get(tag) || 0),
        }));

      const linkCount = recent.reduce((sum, t) => {
        const n = Array.isArray(t.relatedIds) ? t.relatedIds.length : 0;
        return sum + n;
      }, 0);
      const knowledgeDensity =
        recent.length > 0
          ? Math.round((recent.filter((t) => (t.tags || []).length >= 2).length / recent.length) * 100)
          : 0;
      const linkDensity =
        recent.length > 0 ? (linkCount / recent.length).toFixed(1) : '0';

      windows[days] = {
        thoughtCount: recent.length,
        topThemes,
        newThemes,
        growing,
        knowledgeDensity,
        linkDensity,
      };
    });

    const summary = buildNaturalLanguageSummary(windows);

    return {
      generatedAt: Date.now(),
      windows,
      summary,
    };
  }

  /**
   * @param {object} windows
   * @returns {string}
   */
  function buildNaturalLanguageSummary(windows) {
    const w30 = windows[30];
    if (!w30 || !w30.thoughtCount) {
      return '记录更多思考后，系统会分析你近期关注的主题与成长趋势。';
    }

    const top = (w30.topThemes || [])
      .slice(0, 3)
      .map((t) => t.tag)
      .join('、');
    const growing = (w30.growing || [])
      .slice(0, 2)
      .map((g) => g.tag)
      .join('、');

    let text = `最近 30 天你记录了 ${w30.thoughtCount} 条思考。`;
    if (top) {
      text += `持续关注：${top}。`;
    }
    if (growing) {
      text += `其中 ${growing} 相关思考明显增长。`;
    }
    if (w30.knowledgeDensity) {
      text += ` 知识密度约 ${w30.knowledgeDensity}%（多标签深度思考占比）。`;
    }
    return text;
  }

  return {
    WINDOWS,
    buildInsights,
    buildNaturalLanguageSummary,
    filterWindow,
  };
})();
