/**
 * MindTrace — 从页面 HTML 提取 og:image 等预览图 URL（供后台补全）
 */
const MindTracePreviewService = (function () {
  'use strict';

  const FETCH_TIMEOUT_MS = 8000;

  /**
   * @param {string} raw
   * @param {string} base
   * @returns {string}
   */
  function resolveUrl(raw, base) {
    if (!raw || !base) {
      return '';
    }
    try {
      return new URL(String(raw).trim(), base).href;
    } catch (_e) {
      return '';
    }
  }

  /**
   * @param {string} html
   * @param {string} pageUrl
   * @returns {string}
   */
  function extractFromHtml(html, pageUrl) {
    if (!html || !pageUrl) {
      return '';
    }

    const patterns = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const url = resolveUrl(match[1], pageUrl);
        if (url) {
          return url;
        }
      }
    }

    return '';
  }

  /**
   * @param {string} pageUrl
   * @returns {Promise<string>}
   */
  async function fetchPagePreviewUrl(pageUrl) {
    if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
      return '';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(pageUrl, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        return '';
      }

      const contentType = response.headers.get('content-type') || '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml')
      ) {
        return '';
      }

      const html = await response.text();
      return extractFromHtml(html, pageUrl);
    } catch (_err) {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    extractFromHtml,
    fetchPagePreviewUrl,
  };
})();
