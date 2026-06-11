/**
 * MindTrace — Thought Universe static demo
 * Fixed demo data + fixed coordinates + SVG links (no physics engine)
 */
(function () {
  'use strict';

  const STAGE_W = 920;
  const STAGE_H = 560;
  const CX = STAGE_W / 2;
  const CY = STAGE_H / 2;

  function buildDemoData() {
    const hubLabel = getText('demoThemeAiProduct');
    const HUB = {
      id: 'hub',
      label: hubLabel,
      x: CX,
      y: CY,
      type: 'hub',
    };

    const themeDefs = [
      { id: 'theme-knowledge', key: 'demoThemeKnowledge', hue: 'violet', angle: -90 },
      { id: 'theme-workflow', key: 'demoThemeWorkflow', hue: 'cyan', angle: -30 },
      { id: 'theme-wealth', key: 'demoThemeWealth', hue: 'gold', angle: 30 },
      { id: 'theme-growth', key: 'demoThemeGrowth', hue: 'green', angle: 90 },
      { id: 'theme-learn', key: 'demoThemeLearn', hue: 'blue', angle: 150 },
      { id: 'theme-writing', key: 'demoThemeWriting', hue: 'pink', angle: 210 },
    ];

    const THEME_RING_R = 168;
    const THEMES = themeDefs.map((t) => {
      const rad = (t.angle * Math.PI) / 180;
      return {
        id: t.id,
        label: getText(t.key),
        hue: t.hue,
        angle: t.angle,
        type: 'theme',
        x: CX + Math.cos(rad) * THEME_RING_R,
        y: CY + Math.sin(rad) * THEME_RING_R,
        parentId: 'hub',
      };
    });

    const THOUGHTS = [
      { id: 't1', label: 'What is the moat for AI?', themeId: 'theme-knowledge', offsetDeg: -18, dist: 58 },
      { id: 't2', label: 'Which jobs will AI replace?', themeId: 'hub', offsetDeg: -35, dist: 78 },
      { id: 't3', label: 'How to validate AI product value?', themeId: 'hub', offsetDeg: 40, dist: 82 },
      { id: 't4', label: 'Best toolchain combinations', themeId: 'theme-workflow', offsetDeg: 22, dist: 62 },
      { id: 't5', label: 'Second brain methodology', themeId: 'theme-knowledge', offsetDeg: 28, dist: 68 },
      { id: 't6', label: 'Long-term thinking fundamentals', themeId: 'theme-growth', offsetDeg: -25, dist: 64 },
      { id: 't7', label: 'Personal brand building', themeId: 'theme-wealth', offsetDeg: -20, dist: 60 },
      { id: 't8', label: 'Writing skill improvement', themeId: 'theme-writing', offsetDeg: 18, dist: 66 },
    ].map((th) => {
      const anchor =
        th.themeId === 'hub' ? HUB : THEMES.find((t) => t.id === th.themeId);
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
      { id: 'hub', label: hubLabel, count: 2, active: true },
      { id: 'theme-knowledge', label: getText('demoThemeKnowledge'), count: 2 },
      { id: 'theme-workflow', label: getText('demoThemeWorkflow'), count: 1 },
      { id: 'theme-wealth', label: getText('demoThemeWealth'), count: 1 },
      { id: 'theme-growth', label: getText('demoThemeGrowth'), count: 1 },
      { id: 'theme-learn', label: getText('demoThemeLearn'), count: 0 },
      { id: 'theme-writing', label: getText('demoThemeWriting'), count: 1 },
    ];

    const DETAIL = {
      title: hubLabel,
      stats: getText('universeDetailStats', ['3', '6']),
      desc: getText('universeHubDesc'),
      keywords: MindTraceI18n.isChineseUILocale()
        ? ['AI产品', '商业模式', '差异化', '验证']
        : ['AI Product', 'Business Model', 'Differentiation', 'Validation'],
      related: [
        getText('demoThemeKnowledge'),
        getText('demoThemeWorkflow'),
        getText('demoThemeWealth'),
      ],
      thoughts: [
        'Which jobs will AI replace?',
        'How to validate AI product value?',
        'What is the moat for AI?',
      ],
    };

    if (MindTraceI18n.isChineseUILocale()) {
      DETAIL.thoughts = [
        'AI 会取代哪些工作？',
        '如何验证 AI 产品价值？',
        'AI 的护城河是什么？',
      ];
      THOUGHTS.forEach((item, index) => {
        const zhLabels = [
          'AI 的护城河是什么？',
          'AI 会取代哪些工作？',
          '如何验证 AI 产品价值？',
          '工具链的最佳组合',
          '构建第二大脑的方法论',
          '长期主义的底层逻辑',
          '个人品牌建设',
          '写作技巧提升',
        ];
        item.label = zhLabels[index] || item.label;
      });
    }

    return { HUB, THEMES, THOUGHTS, THEME_BY_ID, SIDEBAR_THEMES, DETAIL };
  }

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

  function renderLinks(svg, data) {
    const ns = 'http://www.w3.org/2000/svg';
    const { HUB, THEMES, THOUGHTS } = data;

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
          : data.THEME_BY_ID[thought.parentId];
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

  function renderNodes(container, data) {
    const { HUB, THEMES, THOUGHTS } = data;
    const hubEl = document.createElement('div');
    hubEl.className = 'node node--hub';
    hubEl.style.left = pctX(HUB.x);
    hubEl.style.top = pctY(HUB.y);
    hubEl.innerHTML = `<span class="node-halo"></span><span class="node-sphere">${splitThemeLabel(HUB.label)}</span>`;
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

  function renderSidebar(listEl, sidebarThemes, themeById) {
    listEl.innerHTML = sidebarThemes
      .map((item) => {
        const dotColor =
          item.id === 'hub'
            ? HUE_DOT.hub
            : HUE_DOT[themeById[item.id]?.hue] || HUE_DOT.blue;
        return `<li class="theme-list-item${item.active ? ' is-active' : ''}">
        <span class="theme-list-dot" style="color:${dotColor};background:${dotColor}"></span>
        <span>${item.label}</span>
        <span class="theme-list-count">${item.count}</span>
      </li>`;
      })
      .join('');
  }

  function renderDetail(detail) {
    const titleEl = document.getElementById('detail-title');
    const statsEl = document.getElementById('detail-stats');
    const descEl = document.getElementById('detail-desc');
    const kwEl = document.getElementById('detail-keywords');
    const relEl = document.getElementById('detail-related');
    const thEl = document.getElementById('detail-thoughts');

    if (titleEl) {
      titleEl.textContent = detail.title;
    }
    if (statsEl) {
      statsEl.textContent = detail.stats;
    }
    if (descEl) {
      descEl.textContent = detail.desc;
    }
    if (kwEl) {
      kwEl.innerHTML = detail.keywords
        .map((k) => `<span class="detail-kw">${k}</span>`)
        .join('');
    }
    if (relEl) {
      relEl.innerHTML = detail.related.map((r) => `<li>${r}</li>`).join('');
    }
    if (thEl) {
      thEl.innerHTML = detail.thoughts.map((t) => `<li>${t}</li>`).join('');
    }
  }

  function init() {
    MindTraceI18n.applyPageI18n(document);
    const data = buildDemoData();

    const stage = document.getElementById('universe-stage');
    const svg = document.getElementById('universe-links');
    const nodes = document.getElementById('universe-nodes');
    const list = document.getElementById('theme-list');

    if (!stage || !svg || !nodes) {
      return;
    }

    stage.style.setProperty('--stage-aspect', `${STAGE_W} / ${STAGE_H}`);
    renderLinks(svg, data);
    renderNodes(nodes, data);
    if (list) {
      renderSidebar(list, data.SIDEBAR_THEMES, data.THEME_BY_ID);
    }
    renderDetail(data.DETAIL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
