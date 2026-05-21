/**
 * MindTrace — 开发者联系方式（思维花园引流）
 * 请把下面的占位改成你的真实信息；留空或占位链接不会在页面上显示。
 */
const MindTraceCreator = (function () {
  'use strict';

  /** @type {boolean} */
  const enabled = true;

  /** @type {string} */
  const headline = '喜欢这个工具？';

  /** @type {string} */
  const subline = '欢迎聊聊使用感受、想法反馈或合作';

  /**
   * @typedef {Object} CreatorLink
   * @property {'url'|'mailto'|'copy'} type
   * @property {string} label
   * @property {string} [href] - url / mailto
   * @property {string} [value] - copy 类型（如微信号）
   * @property {string} [hint] - 复制成功提示
   */

  /** @type {CreatorLink[]} */
  const links = [
    {
      type: 'url',
      label: 'GitHub',
      href: 'https://github.com/Lijing327',
    },
    {
      type: 'mailto',
      label: '发邮件',
      href: 'mailto:LinXiWanTing@gmail.com',
    },
    {
      type: 'copy',
      label: '微信',
      value: 'LinXi-5152',
      hint: '微信号已复制',
    },
    {
      type: 'url',
      label: '个人主页',
      href: 'https://xifg.com.cn/',
    },
  ];

  const PLACEHOLDER_MARKERS = [
    'YOUR_',
    'you@example.com',
    'your-website.example',
    'example.com',
  ];

  /**
   * @param {string} [text]
   * @returns {boolean}
   */
  function isPlaceholder(text) {
    const s = (text || '').trim();
    if (!s) {
      return true;
    }
    return PLACEHOLDER_MARKERS.some((mark) => s.includes(mark));
  }

  /**
   * @param {CreatorLink} link
   * @returns {string}
   */
  function resolveHref(link) {
    const raw = (link.href || '').trim();
    if (!raw) {
      return '';
    }
    if (link.type === 'mailto') {
      if (/^mailto:/i.test(raw)) {
        return raw;
      }
      const email = raw.replace(/^mailto:/i, '').trim();
      return email ? `mailto:${email}` : '';
    }
    return raw;
  }

  /**
   * @returns {CreatorLink[]}
   */
  function getActiveLinks() {
    return links
      .filter((link) => {
        if (link.type === 'copy') {
          return !isPlaceholder(link.value);
        }
        return !isPlaceholder(link.href);
      })
      .map((link) => {
        if (link.type === 'mailto') {
          return { ...link, href: resolveHref(link) };
        }
        return link;
      });
  }

  return {
    enabled,
    headline,
    subline,
    getActiveLinks,
  };
})();
