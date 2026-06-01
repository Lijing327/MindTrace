/**
 * MindTrace — 思维宇宙静态 Demo
 * 固定假数据 + 固定坐标 + SVG 手绘连线（无物理引擎 / 无真实数据）
 */
(function () {
  'use strict';

  /** 画布逻辑尺寸（与 CSS 百分比换算） */
  const STAGE_W = 920;
  const STAGE_H = 560;
  const CX = STAGE_W / 2;
  const CY = STAGE_H / 2;

  /** 中心恒星 */
  const HUB = {
    id: 'hub',
    label: 'AI 与产品',
    x: CX,
    y: CY,
    type: 'hub',
  };

  /**
   * 六个主题：均匀环绕中心（半径 168px，从顶部 -90° 起每 60°）
   */
  const THEME_RING_R = 168;
  const THEMES = [
    { id: 'theme-knowledge', label: '知识系统', hue: 'violet', angle: -90 },
    { id: 'theme-workflow', label: '工作流', hue: 'cyan', angle: -30 },
    { id: 'theme-wealth', label: '财富与商业', hue: 'gold', angle: 30 },
    { id: 'theme-growth', label: '成长与思维', hue: 'green', angle: 90 },
    { id: 'theme-learn', label: '学习与认知', hue: 'blue', angle: 150 },
    { id: 'theme-writing', label: '写作与表达', hue: 'pink', angle: 210 },
  ].map((t) => {
    const rad = (t.angle * Math.PI) / 180;
    return {
      ...t,
      type: 'theme',
      x: CX + Math.cos(rad) * THEME_RING_R,
      y: CY + Math.sin(rad) * THEME_RING_R,
      parentId: 'hub',
    };
  });

  /**
   * 思考胶囊：围绕所属主题（半径 52~72px，角度错开避免重叠）
   */
  const THOUGHTS = [
    {
      id: 't1',
      label: 'AI 的护城河是什么？',
      themeId: 'theme-knowledge',
      offsetDeg: -18,
      dist: 58,
    },
    {
      id: 't2',
      label: 'AI 会取代哪些工作？',
      themeId: 'hub',
      offsetDeg: -35,
      dist: 78,
    },
    {
      id: 't3',
      label: '如何验证 AI 产品价值？',
      themeId: 'hub',
      offsetDeg: 40,
      dist: 82,
    },
    {
      id: 't4',
      label: '工具链的最佳组合',
      themeId: 'theme-workflow',
      offsetDeg: 22,
      dist: 62,
    },
    {
      id: 't5',
      label: '构建第二大脑的方法论',
      themeId: 'theme-knowledge',
      offsetDeg: 28,
      dist: 68,
    },
    {
      id: 't6',
      label: '长期主义的底层逻辑',
      themeId: 'theme-growth',
      offsetDeg: -25,
      dist: 64,
    },
    {
      id: 't7',
      label: '个人品牌建设',
      themeId: 'theme-wealth',
      offsetDeg: -20,
      dist: 60,
    },
    {
      id: 't8',
      label: '写作技巧提升',
      themeId: 'theme-writing',
      offsetDeg: 18,
      dist: 66,
    },
  ].map((th) => {
    const anchor =
      th.themeId === 'hub'
        ? HUB
        : THEMES.find((t) => t.id === th.themeId);
    const baseRad = Math.atan2(anchor.y - CY, anchor.x - CX);
    const rad = baseRad + (th.offsetDeg * Math.PI) / 180;
    return {
      ...th,
      type: 'thought',
      x: anchor.x + Math.cos(rad) * th.dist,
      y: anchor.y + Math.sin(rad) * th.dist,
      parentId: anchor.id,
    };
  });

  const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

  const SIDEBAR_THEMES = [
    { id: 'hub', label: 'AI 与产品', count: 2, active: true },
    { id: 'theme-knowledge', label: '知识系统', count: 2 },
    { id: 'theme-workflow', label: '工作流', count: 1 },
    { id: 'theme-wealth', label: '财富与商业', count: 1 },
    { id: 'theme-growth', label: '成长与思维', count: 1 },
    { id: 'theme-learn', label: '学习与认知', count: 0 },
    { id: 'theme-writing', label: '写作与表达', count: 1 },
  ];

  const DETAIL = {
    title: 'AI 与产品',
    stats: '3 条思考 · 6 个关联主题',
    desc: '关于 AI 产品机会、差异化与验证路径的思考聚合，是你当前认知宇宙的核心恒星。',
    keywords: ['AI产品', '商业模式', '差异化', '验证'],
    related: ['知识系统', '工作流', '财富与商业'],
    thoughts: [
      'AI 会取代哪些工作？',
      '如何验证 AI 产品价值？',
      'AI 的护城河是什么？',
    ],
  };

  const HUE_DOT = {
    hub: '#a78bfa',
    violet: '#a78bfa',
    cyan: '#22d3ee',
    gold: '#fbbf24',
    green: '#34d399',
    blue: '#60a5fa',
    pink: '#f472b6',
  };

  function pctX(x) {
    return `${(x / STAGE_W) * 100}%`;
  }

  function pctY(y) {
    return `${(y / STAGE_H) * 100}%`;
  }

  function splitThemeLabel(label) {
    if (label.length <= 3) {
      return label;
    }
    const mid = Math.ceil(label.length / 2);
    return `${label.slice(0, mid)}<br>${label.slice(mid)}`;
  }

  /**
   * 二次贝塞尔曲线（轻微弯曲能量流）
   */
  function curvedPath(x1, y1, x2, y2, bend) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / len) * len * bend;
    const cy = my + (dx / len) * len * bend;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }

  function edgePoint(ax, ay, bx, by, radius) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: ax + (dx / len) * radius,
      y: ay + (dy / len) * radius,
    };
  }

  function renderLinks(svg) {
    const ns = 'http://www.w3.org/2000/svg';

    THEMES.forEach((theme) => {
      const p1 = edgePoint(HUB.x, HUB.y, theme.x, theme.y, 52);
      const p2 = edgePoint(theme.x, theme.y, HUB.x, HUB.y, 28);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', curvedPath(p1.x, p1.y, p2.x, p2.y, 0.06));
      path.setAttribute('class', 'link-hub');
      svg.appendChild(path);
    });

    THOUGHTS.forEach((thought) => {
      const parent =
        thought.parentId === 'hub'
          ? HUB
          : THEME_BY_ID[thought.parentId];
      if (!parent) {
        return;
      }
      const pr = parent.type === 'hub' ? 52 : 28;
      const p1 = edgePoint(parent.x, parent.y, thought.x, thought.y, pr);
      const p2 = edgePoint(thought.x, thought.y, parent.x, parent.y, 4);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', curvedPath(p1.x, p1.y, p2.x, p2.y, 0.04));
      path.setAttribute('class', 'link-sub');
      svg.appendChild(path);
    });
  }

  function renderNodes(container) {
    const hubEl = document.createElement('div');
    hubEl.className = 'node node--hub';
    hubEl.style.left = pctX(HUB.x);
    hubEl.style.top = pctY(HUB.y);
    hubEl.innerHTML =
      '<span class="node-halo"></span><span class="node-sphere">AI 与<br>产品</span>';
    container.appendChild(hubEl);

    THEMES.forEach((theme) => {
      const el = document.createElement('div');
      el.className = 'node node--theme';
      el.dataset.hue = theme.hue;
      el.style.left = pctX(theme.x);
      el.style.top = pctY(theme.y);
      el.innerHTML = `<span class="node-halo"></span><span class="node-sphere">${splitThemeLabel(theme.label)}</span>`;
      container.appendChild(el);
    });

    THOUGHTS.forEach((thought) => {
      const el = document.createElement('div');
      el.className = 'node node--thought';
      el.style.left = pctX(thought.x);
      el.style.top = pctY(thought.y);
      el.innerHTML = `<span class="node-capsule-glow"></span><span class="node-capsule">${thought.label}</span>`;
      container.appendChild(el);
    });
  }

  function renderSidebar(listEl) {
    listEl.innerHTML = SIDEBAR_THEMES.map((item) => {
      const dotColor =
        item.id === 'hub' ? HUE_DOT.hub : HUE_DOT[THEME_BY_ID[item.id]?.hue] || HUE_DOT.blue;
      return `<li class="theme-list-item${item.active ? ' is-active' : ''}">
        <span class="theme-list-dot" style="color:${dotColor};background:${dotColor}"></span>
        <span>${item.label}</span>
        <span class="theme-list-count">${item.count}</span>
      </li>`;
    }).join('');
  }

  function renderDetail() {
    const kwEl = document.getElementById('detail-keywords');
    const relEl = document.getElementById('detail-related');
    const thEl = document.getElementById('detail-thoughts');
    if (kwEl) {
      kwEl.innerHTML = DETAIL.keywords
        .map((k) => `<span class="detail-kw">${k}</span>`)
        .join('');
    }
    if (relEl) {
      relEl.innerHTML = DETAIL.related.map((r) => `<li>${r}</li>`).join('');
    }
    if (thEl) {
      thEl.innerHTML = DETAIL.thoughts.map((t) => `<li>${t}</li>`).join('');
    }
  }

  function init() {
    const stage = document.getElementById('universe-stage');
    const svg = document.getElementById('universe-links');
    const nodes = document.getElementById('universe-nodes');
    const list = document.getElementById('theme-list');

    if (!stage || !svg || !nodes) {
      return;
    }

    stage.style.setProperty('--stage-aspect', `${STAGE_W} / ${STAGE_H}`);
    renderLinks(svg);
    renderNodes(nodes);
    if (list) {
      renderSidebar(list);
    }
    renderDetail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
