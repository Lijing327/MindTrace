/**
 * MindTrace — 思维宇宙（三栏 · 主题星系 + 双层节点图谱）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ForceGraph2D from 'react-force-graph-2d';

const BG = '#050B1F';
const FOLLOW_KEY_PREFIX = 'mindtrace_followed_themes_';
const HIGH_SIM = 0.85;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const THEME_COLOR_RULES = [
  { test: (t) => /AI|产品/.test(t), hsl: [258, 78, 68] },
  { test: (t) => /知识系统|知识/.test(t), hsl: [270, 72, 66] },
  { test: (t) => /工作流/.test(t), hsl: [192, 78, 58] },
  { test: (t) => /财富|商业/.test(t), hsl: [42, 88, 62] },
  { test: (t) => /成长|思维/.test(t), hsl: [152, 62, 56] },
  { test: (t) => /写作|表达/.test(t), hsl: [328, 72, 66] },
];
const FALLBACK_HUES = [220, 255, 195, 42, 155, 325];

function brightenHsl(hsl, amount) {
  const [h, s, l] = hsl;
  return [h, Math.min(92, s + 6), Math.min(76, l + amount)];
}

function formatNodeDate(timestamp) {
  if (!timestamp) {
    return '';
  }
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getGardenIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('garden') || null;
}

function openThoughtInGarden(thoughtId, gardenId) {
  if (!thoughtId) {
    return;
  }
  const g = gardenId || getGardenIdFromUrl() || 'garden-default';
  window.location.href = `dashboard.html?thought=${encodeURIComponent(thoughtId)}&garden=${encodeURIComponent(g)}`;
}

function resolveThemeHsl(themeName, index) {
  const t = themeName || '';
  for (const rule of THEME_COLOR_RULES) {
    if (rule.test(t)) {
      return rule.hsl;
    }
  }
  const h = FALLBACK_HUES[index % FALLBACK_HUES.length];
  return [h, 72, 64];
}

function drawLabel(ctx, text, x, y, font, fillAlpha, globalScale) {
  if (!text) {
    return;
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, 3.5 / globalScale);
  ctx.strokeStyle = `rgba(5, 11, 31, ${0.85 * fillAlpha})`;
  ctx.fillStyle = `rgba(244, 247, 255, ${0.96 * fillAlpha})`;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function hsla(hsl, a) {
  const [h, s, l] = hsl;
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** 稳定光照方向（每节点一致，像星图上的固定光源） */
function lightAngleFromId(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 628;
  }
  return h / 100;
}

function surfacePoint(node, tx, ty) {
  const dx = tx - node.x;
  const dy = ty - node.y;
  const dist = Math.hypot(dx, dy) || 1;
  let pad = node.radius || nodeRadiusFor(node);
  if (node.nodeType === 'thought') {
    pad = node.radius || GALAXY.thoughtR || 7;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  return { x: node.x + ux * pad * 0.94, y: node.y + uy * pad * 0.94, ux, uy };
}

/** 多层星冕 */
function drawPlanetCorona(ctx, x, y, r, hsl, alpha, intensity) {
  const layers = [
    { mul: 2.8, a: 0.06 * intensity },
    { mul: 2.0, a: 0.14 * intensity },
    { mul: 1.45, a: 0.22 * intensity },
  ];
  layers.forEach(({ mul, a }) => {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * mul);
    g.addColorStop(0, hsla([hsl[0], hsl[1] - 4, Math.min(92, hsl[2] + 22)], a * alpha));
    g.addColorStop(0.45, hsla(hsl, a * 0.65 * alpha));
    g.addColorStop(1, hsla([hsl[0], hsl[1], hsl[2]], 0));
    ctx.beginPath();
    ctx.arc(x, y, r * mul, 0, 2 * Math.PI);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

/** 球体材质：暗面、大气缘、高光 */
function drawPlanetSphere(ctx, x, y, r, hsl, alpha, nodeId, hub) {
  const la = lightAngleFromId(nodeId);
  const lx = x + Math.cos(la) * r * 0.38;
  const ly = y + Math.sin(la) * r * 0.38 - r * 0.08;

  const body = ctx.createRadialGradient(lx, ly, r * 0.05, x, y, r * 1.05);
  body.addColorStop(0, hsla([hsl[0], Math.min(95, hsl[1] + 8), Math.min(88, hsl[2] + 28)], 0.98 * alpha));
  body.addColorStop(0.35, hsla([hsl[0], hsl[1], Math.min(72, hsl[2] + 8)], 0.95 * alpha));
  body.addColorStop(0.72, hsla(hsl, 0.9 * alpha));
  body.addColorStop(1, hsla([hsl[0], hsl[1] - 6, Math.max(18, hsl[2] - 32)], alpha));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = body;
  ctx.fill();

  const term = ctx.createRadialGradient(
    x - Math.cos(la) * r * 0.5,
    y - Math.sin(la) * r * 0.5,
    r * 0.1,
    x,
    y,
    r
  );
  term.addColorStop(0, 'rgba(2, 6, 18, 0)');
  term.addColorStop(0.55, 'rgba(2, 8, 24, 0)');
  term.addColorStop(1, `rgba(2, 4, 14, ${hub ? 0.55 : 0.42 * alpha})`);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = term;
  ctx.fill();

  ctx.save();
  ctx.shadowBlur = hub ? r * 0.35 : r * 0.22;
  ctx.shadowColor = hsla([hsl[0], hsl[1], Math.min(90, hsl[2] + 18)], 0.75 * alpha);
  ctx.strokeStyle = hsla([hsl[0], Math.min(92, hsl[1] + 12), Math.min(88, hsl[2] + 24)], 0.55 * alpha);
  ctx.lineWidth = Math.max(0.6, (hub ? 1.8 : 1.1));
  ctx.beginPath();
  ctx.arc(x, y, r * 0.98, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();

  const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.55);
  spec.addColorStop(0, `rgba(255, 255, 255, ${(hub ? 0.55 : 0.38) * alpha})`);
  spec.addColorStop(0.35, hsla([hsl[0], 40, 92], 0.12 * alpha));
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(lx, ly, r * (hub ? 0.42 : 0.32), 0, 2 * Math.PI);
  ctx.fillStyle = spec;
  ctx.fill();
}

/** 记录节点：14px 发光卫星点（常隐标题，hover 由 nodeLabel 展示） */
function drawRecordDot(ctx, node, hsl, alpha, active) {
  const r = node.radius || GALAXY.thoughtR;
  node.moonR = r;
  node.radius = r;

  if (active) {
    drawPlanetCorona(ctx, node.x, node.y, r * 2.2, hsl, alpha, 1.4);
  }
  drawPlanetCorona(ctx, node.x, node.y, r * 1.4, hsl, alpha, 0.75);

  const body = ctx.createRadialGradient(
    node.x - r * 0.25,
    node.y - r * 0.25,
    0,
    node.x,
    node.y,
    r
  );
  body.addColorStop(0, `rgba(220, 240, 255, ${0.95 * alpha})`);
  body.addColorStop(0.45, hsla([hsl[0], hsl[1], Math.min(88, hsl[2] + 18)], 0.9 * alpha));
  body.addColorStop(1, hsla([hsl[0], hsl[1], hsl[2]], 0.5 * alpha));

  ctx.save();
  ctx.shadowBlur = active ? r * 3 : r * 2;
  ctx.shadowColor = hsla(hsl, 0.85 * alpha);
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
}

/** 能量流连线（多层辉光 + 渐变核心） */
function paintEnergyFlow(ctx, s, t, hsl, dim, globalScale, curvature, strength) {
  const p1 = surfacePoint(s, t.x, t.y);
  const p2 = surfacePoint(t, s.x, s.y);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (p1.x + p2.x) / 2 + (-dy / dist) * dist * curvature;
  const my = (p1.y + p2.y) / 2 + (dx / dist) * dist * curvature;

  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(mx, my, p2.x, p2.y);
  };

  const coreW = (0.5 + strength * 1.4) / globalScale;
  const glowW = coreW * (3.2 + strength * 2);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawPath();
  ctx.strokeStyle = hsla([hsl[0], hsl[1], Math.min(75, hsl[2] + 8)], 0.08 * dim);
  ctx.lineWidth = glowW * 2.2;
  ctx.shadowBlur = glowW * 3;
  ctx.shadowColor = hsla(hsl, 0.45 * dim);
  ctx.stroke();

  drawPath();
  const beam = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
  beam.addColorStop(0, hsla([hsl[0], hsl[1], Math.min(85, hsl[2] + 20)], 0.05 * dim));
  beam.addColorStop(0.35, hsla(hsl, 0.35 * dim));
  beam.addColorStop(0.65, hsla([hsl[0], Math.min(95, hsl[1] + 10), Math.min(88, hsl[2] + 16)], 0.5 * dim));
  beam.addColorStop(1, hsla([hsl[0], hsl[1], hsl[2]], 0.12 * dim));
  ctx.strokeStyle = beam;
  ctx.lineWidth = glowW;
  ctx.shadowBlur = glowW * 1.2;
  ctx.shadowColor = hsla(hsl, 0.35 * dim);
  ctx.stroke();

  drawPath();
  ctx.shadowBlur = coreW * 4;
  ctx.shadowColor = `rgba(200, 230, 255, ${0.7 * dim})`;
  ctx.strokeStyle = hsla([hsl[0], Math.min(98, hsl[1] + 15), Math.min(92, hsl[2] + 26)], 0.75 * dim);
  ctx.lineWidth = coreW;
  ctx.stroke();

  ctx.restore();
}

/** 星系布局（固定坐标，非力导向） */
const GALAXY = {
  themeHubR: 70,
  themePeerR: 40,
  subclusterR: 35,
  thoughtR: 7,
  hubHsl: [218, 82, 62],
  clusterHsl: [
    [270, 72, 66],
    [192, 78, 58],
    [152, 62, 56],
    [42, 88, 62],
    [328, 72, 66],
    [220, 70, 64],
  ],
  satelliteOrbit: 48,
  minClusterRing: 175,
  maxClusterRing: 260,
};

const NODE_RADIUS = {
  themeHub: GALAXY.themeHubR,
  themePeer: GALAXY.themePeerR,
  subcluster: GALAXY.subclusterR,
};

function nodeRadiusFor(node) {
  if (node.nodeType === 'theme') {
    return node.isHub ? GALAXY.themeHubR : GALAXY.themePeerR;
  }
  if (node.nodeType === 'subcluster') {
    return GALAXY.subclusterR;
  }
  if (node.nodeType === 'thought') {
    return node.radius || GALAXY.thoughtR;
  }
  return GALAXY.thoughtR;
}

function clusterRingRadius(cx, cy) {
  const minDim = Math.min(cx, cy) * 2;
  return Math.min(
    GALAXY.maxClusterRing,
    Math.max(GALAXY.minClusterRing, minDim * 0.34)
  );
}


function truncateLabel(text, maxLen) {
  const t = (text || '').trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen)}…`;
}

function splitLinesForCircle(text, maxChars, maxLines) {
  const t = (text || '').trim() || '思考';
  if (t.length <= maxChars) {
    return [t];
  }
  const parts = t.split(/[·•]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, maxLines).map((p) =>
      p.length > maxChars ? `${p.slice(0, maxChars - 1)}…` : p
    );
  }
  const lines = [];
  for (let i = 0; i < t.length && lines.length < maxLines; i += maxChars) {
    lines.push(t.slice(i, i + maxChars) + (i + maxChars < t.length ? '…' : ''));
  }
  return lines;
}

function drawInsideCircle(ctx, lines, x, y, radius, fontSize, alpha, hsl) {
  const lh = fontSize * 1.22;
  const startY = y - ((lines.length - 1) * lh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.88, 0, 2 * Math.PI);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = hsla(hsl || [220, 70, 70], 0.7 * alpha);
    ctx.fillStyle = `rgba(248, 252, 255, ${0.96 * alpha})`;
    ctx.fillText(line, x, startY + i * lh);
  });
  ctx.restore();
}

function drawCaption(ctx, text, x, y, fontSize, alpha, globalScale, hsl) {
  if (!text) {
    return;
  }
  ctx.save();
  ctx.font = `400 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowBlur = 8 / globalScale;
  ctx.shadowColor = hsla(hsl || [210, 60, 65], 0.55 * alpha);
  ctx.fillStyle = `rgba(170, 195, 240, ${0.82 * alpha})`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function isNodePlaced(node) {
  return node && Number.isFinite(node.x) && Number.isFinite(node.y);
}

function themeDescription(themeName) {
  if (!themeName) {
    return '尚未命名的思考聚类';
  }
  return `关于「${themeName}」相关方向的思考集合，帮助你看见反复出现的关注点。`;
}

function strengthLabel(score) {
  const pct = Math.round((score || 0) * 100);
  if (score >= 0.8) {
    return `强关联 · ${pct}%`;
  }
  if (score >= 0.65) {
    return `中等关联 · ${pct}%`;
  }
  return `弱关联 · ${pct}%`;
}

function computeNetworkDensity(thoughtCount, linkCount) {
  if (thoughtCount < 2) {
    return 0;
  }
  const max = (thoughtCount * (thoughtCount - 1)) / 2;
  return max > 0 ? Math.round((linkCount / max) * 100) / 100 : 0;
}

/** 全部：主题星球均匀环布（星系鸟瞰） */
function layoutThemesOnlyRing(themeNodes, cx, cy) {
  const n = themeNodes.length;
  const ringR = clusterRingRadius(cx, cy) * 0.85;
  themeNodes.forEach((theme, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    theme.x = cx + Math.cos(angle) * ringR;
    theme.y = cy + Math.sin(angle) * ringR;
    theme.isHub = false;
    theme.fx = theme.x;
    theme.fy = theme.y;
    theme.radius = GALAXY.themePeerR;
    theme.val = theme.radius * 2;
    theme.clusterHsl = GALAXY.clusterHsl[i % GALAXY.clusterHsl.length];
  });
  return themeNodes;
}

/**
 * 记录卫星：绕主题簇小圆轨道均匀分布（禁止沿径向叠成列表）
 */
function layoutSatelliteRing(sub, satellites, subIndex, subTotal, hubCx, hubCy) {
  const n = satellites.length;
  if (!n) {
    return;
  }
  const outward = Math.atan2(sub.y - hubCy, sub.x - hubCx);
  const orbitR =
    GALAXY.satelliteOrbit +
    Math.min(22, n * 2.5) +
    (subTotal > 4 ? (subIndex % 3) * 6 : 0);
  const phase = outward + (subIndex / Math.max(1, subTotal)) * 0.35;

  satellites.forEach((sat, idx) => {
    const angle =
      n === 1 ? phase + Math.PI / 2 : phase + (idx / n) * Math.PI * 2;
    sat.x = sub.x + Math.cos(angle) * orbitR;
    sat.y = sub.y + Math.sin(angle) * orbitR;
    sat.radius = GALAXY.thoughtR;
    sat.val = GALAXY.thoughtR * 2;
    sat.fx = sat.x;
    sat.fy = sat.y;
  });
}

/** 星系布局：中心恒星 → 主题簇六边形环 → 记录卫星圈 */
function layoutGalaxySystem(hubTheme, subNodes, thoughtNodes, cx, cy) {
  const ringR = clusterRingRadius(cx, cy);

  hubTheme.isHub = true;
  hubTheme.x = cx;
  hubTheme.y = cy;
  hubTheme.radius = GALAXY.themeHubR;
  hubTheme.val = hubTheme.radius * 2;
  hubTheme.fx = cx;
  hubTheme.fy = cy;
  hubTheme.clusterHsl = GALAXY.hubHsl;

  const subN = subNodes.length;
  subNodes.forEach((sub, i) => {
    const angle = (i / Math.max(1, subN)) * Math.PI * 2 - Math.PI / 2;
    sub.x = cx + Math.cos(angle) * ringR;
    sub.y = cy + Math.sin(angle) * ringR;
    sub.radius = GALAXY.subclusterR;
    sub.val = sub.radius * 2;
    sub.fx = sub.x;
    sub.fy = sub.y;
    sub.clusterHsl = GALAXY.clusterHsl[i % GALAXY.clusterHsl.length];
  });

  subNodes.forEach((sub, subIndex) => {
    const ids = new Set(sub.recordIds || []);
    const satellites = thoughtNodes.filter((t) => ids.has(t.id));
    satellites.forEach((n) => {
      n.subClusterId = sub.id;
      n.parentThemeId = hubTheme.clusterId;
      n.clusterHsl = sub.clusterHsl;
    });
    layoutSatelliteRing(sub, satellites, subIndex, subN, cx, cy);
  });

  return [hubTheme, ...subNodes, ...thoughtNodes];
}

function pinAllNodes(nodes) {
  nodes.forEach((n) => {
    if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
      n.fx = n.x;
      n.fy = n.y;
    }
  });
}

function buildThoughtNodes(thoughts, meta) {
  const themeNameMap = new Map(meta.map((m) => [m.clusterId, m.theme]));
  const assign =
    typeof MindTraceThemeGalaxyService !== 'undefined' &&
    typeof MindTraceThemeGalaxyService.assignThemeId === 'function'
      ? MindTraceThemeGalaxyService.assignThemeId.bind(MindTraceThemeGalaxyService)
      : () => 'theme-misc';

  return thoughts.map((t) => {
    const themeId = assign(t);
    const label = MindTraceGraphService.extractLabel(t);
    return {
      id: t.id,
      nodeType: 'thought',
      label,
      name: label,
      themeId,
      cluster: themeId,
      clusterLabel: themeNameMap.get(themeId) || '',
      createdAt: t.createdAt,
      weight: 4,
      degree: 0,
    };
  });
}

function buildSubClusterNodes(themeId, members, semanticLinks) {
  if (
    typeof MindTraceThemeGalaxyService === 'undefined' ||
    typeof MindTraceThemeGalaxyService.buildSubClustersForTheme !== 'function'
  ) {
    return [];
  }
  const subMeta = MindTraceThemeGalaxyService.buildSubClustersForTheme(
    themeId,
    members,
    semanticLinks
  );
  return subMeta.map((sc) => ({
    id: `sub:${sc.subClusterId}`,
    nodeType: 'subcluster',
    label: sc.label,
    subClusterId: sc.subClusterId,
    themeId: sc.themeId,
    parentThemeId: themeId,
    clusterId: sc.subClusterId,
    count: sc.count,
    recordIds: sc.recordIds || [],
    val: NODE_RADIUS.subcluster * 2,
  }));
}

/**
 * 图谱：主题 → 主题簇 → 记录（三层）+ 主题间关系
 */
function buildUniverseData(
  thoughts,
  meta,
  thoughtById,
  semanticLinks,
  cx,
  cy,
  focusThemeId
) {
  const themeNodes = meta.map((m) => ({
    id: `theme:${m.clusterId}`,
    nodeType: 'theme',
    label: m.theme,
    clusterId: m.clusterId,
    count: m.count,
    recordIds: m.recordIds || [],
    description: m.description,
    val: NODE_RADIUS.themeHub * 2,
    x: cx,
    y: cy,
  }));

  const themeLinks =
    typeof MindTraceThemeGalaxyService !== 'undefined'
      ? MindTraceThemeGalaxyService.buildThemeLinks(meta, semanticLinks)
      : [];

  if (!focusThemeId) {
    const nodes = layoutThemesOnlyRing(themeNodes, cx, cy);
    pinAllNodes(nodes);
    return {
      nodes,
      links: themeLinks.map((l) => ({ ...l, linkType: 'theme' })),
      thoughtCount: thoughts.length,
      themeCount: themeNodes.length,
      hubId: null,
    };
  }

  const focusMeta = meta.find((m) => m.clusterId === focusThemeId);
  const hubTheme = themeNodes.find((t) => t.clusterId === focusThemeId);
  const members = (focusMeta?.recordIds || [])
    .map((id) => thoughtById.get(id))
    .filter(Boolean);

  const subNodes = buildSubClusterNodes(
    focusThemeId,
    members,
    semanticLinks
  );
  const subIds = new Set();
  subNodes.forEach((s) => {
    (s.recordIds || []).forEach((id) => subIds.add(id));
  });

  const allThoughtNodes = buildThoughtNodes(thoughts, meta);
  const thoughtNodes = allThoughtNodes.filter(
    (n) => n.themeId === focusThemeId && subIds.has(n.id)
  );

  const nodes = layoutGalaxySystem(hubTheme, subNodes, thoughtNodes, cx, cy);
  pinAllNodes(nodes);

  const recordToSub = new Map();
  subNodes.forEach((s) => {
    (s.recordIds || []).forEach((rid) => recordToSub.set(rid, s.id));
  });

  const themeSubLinks = subNodes.map((s) => ({
    source: hubTheme.id,
    target: s.id,
    similarity: 0.7,
    linkType: 'theme-sub',
  }));

  const subThoughtLinks = thoughtNodes.map((n) => ({
    source: recordToSub.get(n.id),
    target: n.id,
    similarity: 0.6,
    linkType: 'sub-thought',
  }));

  return {
    nodes,
    links: [...themeSubLinks, ...subThoughtLinks],
    thoughtCount: thoughtNodes.length,
    themeCount: themeNodes.length,
    subClusterCount: subNodes.length,
    hubId: focusThemeId,
  };
}

function CosmosGraph({
  selectedClusterId,
  onSelectCluster,
  onSelectThought,
  highlightId,
  hoveredId,
  setHoveredId,
  gardenId,
  onDataLoaded,
}) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const loadRef = useRef({
    thoughts: [],
    meta: [],
    thoughtById: new Map(),
    semanticLinks: [],
  });
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [status, setStatus] = useState('loading');
  const [statusDetail, setStatusDetail] = useState('正在载入思考…');

  const resize = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setSize({
      w: Math.max(280, Math.floor(rect.width)),
      h: Math.max(240, Math.floor(rect.height)),
    });
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setStatus('loading');
      setStatusDetail('正在载入当前花园的思考…');

      try {
        const resolvedGarden =
          gardenId ||
          (typeof MindTraceGardenService !== 'undefined'
            ? await MindTraceGardenService.getCurrentGardenId()
            : null);

        const thoughts = resolvedGarden
          ? await MindTraceStorage.getAll(resolvedGarden)
          : await MindTraceStorage.getAllRaw();

        if (!thoughts.length) {
          if (!cancelled) {
            setGraphData({ nodes: [], links: [] });
            setStatus('empty');
            setStatusDetail('还没有记录，去网页划词或按 Alt+Shift+N 空白速记吧');
            onDataLoaded({ thoughts: [], meta: [], metrics: null, thoughtById: new Map() });
          }
          return;
        }

        const graphRaw = MindTraceGraphService.buildGraph(thoughts);
        const semanticLinks = graphRaw.links || [];
        const thoughtById = new Map(thoughts.map((t) => [t.id, t]));
        const rect = containerRef.current?.getBoundingClientRect();
        const cx = rect ? rect.width / 2 : 400;
        const cy = rect ? rect.height / 2 : 300;

        const meta =
          typeof MindTraceThemeGalaxyService !== 'undefined' &&
          typeof MindTraceThemeGalaxyService.buildThemeMeta === 'function'
            ? MindTraceThemeGalaxyService.buildThemeMeta(thoughts)
            : [];

        loadRef.current = { thoughts, meta, thoughtById, semanticLinks };
        const focusId = selectedClusterId || null;
        const universe = buildUniverseData(
          thoughts,
          meta,
          thoughtById,
          semanticLinks,
          cx,
          cy,
          focusId
        );
        const density = computeNetworkDensity(universe.thoughtCount, semanticLinks.length);

        if (!cancelled) {
          setGraphData({ nodes: universe.nodes, links: universe.links });
          setStatus('ready');
          onDataLoaded({
            thoughts,
            meta,
            metrics: {
              thoughts: universe.thoughtCount,
              links: semanticLinks.length,
              themes: universe.themeCount,
              density,
            },
            thoughtById,
            semanticLinks,
            themeByCluster: new Map(meta.map((m, i) => [m.clusterId, { ...m, colorIndex: i }])),
          });
        }
      } catch (err) {
        console.error('[MindTrace Graph] load failed:', err);
        if (!cancelled) {
          setStatus('error');
          setStatusDetail('加载失败，请刷新页面');
        }
      }
    }

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [gardenId]);

  useEffect(() => {
    const { thoughts, meta, thoughtById, semanticLinks } = loadRef.current;
    if (status !== 'ready' || !thoughts.length || !meta.length) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const focusId = selectedClusterId || null;
    const universe = buildUniverseData(
      thoughts,
      meta,
      thoughtById,
      semanticLinks,
      cx,
      cy,
      focusId
    );
    setGraphData({ nodes: universe.nodes, links: universe.links });
  }, [selectedClusterId, status, size.w, size.h]);

  useEffect(() => {
    const fg = fgRef.current;
    if (status !== 'ready' || !fg || typeof fg.d3Force !== 'function') {
      return;
    }
    try {
      if (typeof fg.d3Force === 'function') {
        fg.d3Force('charge', null);
        fg.d3Force('link', null);
      }
      pinAllNodes(graphData.nodes);

      window.setTimeout(() => {
        try {
          const hub = graphData.nodes.find(
            (n) => n.nodeType === 'theme' && n.isHub
          );
            if (hub && typeof fg.centerAt === 'function') {
            fg.centerAt(hub.x, hub.y, 200);
            if (typeof fg.zoom === 'function') {
              fg.zoom(selectedClusterId ? 0.78 : 0.72, 200);
            }
          } else if (
            typeof fg.zoomToFit === 'function' &&
            graphData.nodes.length > 0
          ) {
            fg.zoomToFit(280, 48);
          }
        } catch (e) {
          console.warn('[MindTrace Graph] zoom:', e);
        }
      }, 80);
    } catch (err) {
      console.warn('[MindTrace Graph] layout pin:', err);
    }
  }, [status, graphData, selectedClusterId]);

  const nodeById = useMemo(() => {
    const map = new Map();
    graphData.nodes.forEach((n) => {
      if (n?.id) {
        map.set(n.id, n);
      }
    });
    return map;
  }, [graphData.nodes]);

  const themeColorIndex = useMemo(() => {
    const m = new Map();
    graphData.nodes
      .filter((n) => n.nodeType === 'theme')
      .forEach((n, i) => m.set(n.clusterId, i));
    return m;
  }, [graphData.nodes]);

  const nodeAlpha = useCallback(
    (node) => {
      if (!selectedClusterId) {
        return 1;
      }
      const tid = node.parentThemeId || node.themeId || node.clusterId;
      if (
        node.nodeType === 'theme' &&
        node.clusterId === selectedClusterId
      ) {
        return 1;
      }
      if (tid === selectedClusterId || node.themeId === selectedClusterId) {
        return 1;
      }
      if (node.nodeType === 'theme') {
        return 0.55;
      }
      return 0.35;
    },
    [selectedClusterId]
  );

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      if (!isNodePlaced(node) || !globalScale || globalScale <= 0) {
        return;
      }

      const alpha = nodeAlpha(node);
      const isTheme = node.nodeType === 'theme';
      const isSub = node.nodeType === 'subcluster';
      const isThought = node.nodeType === 'thought';
      const parentThemeId =
        node.parentThemeId || node.themeId || node.clusterId;
      const colorIdx = themeColorIndex.get(parentThemeId) ?? 0;
      const parentMeta = graphData.nodes.find(
        (n) => n.nodeType === 'theme' && n.clusterId === parentThemeId
      );
      const hsl =
        node.clusterHsl ||
        (node.isHub
          ? GALAXY.hubHsl
          : resolveThemeHsl(
              isTheme ? node.label : parentMeta?.label || node.clusterLabel,
              colorIdx
            ));
      const r = node.radius || nodeRadiusFor(node);
      const active = highlightId === node.id || hoveredId === node.id;

      if (isThought) {
        drawRecordDot(ctx, node, hsl, alpha, active);
        return;
      }

      const coronaBoost = node.isHub ? 1.45 : isSub ? 1.12 : active ? 1.18 : 0.95;
      drawPlanetCorona(ctx, node.x, node.y, r, hsl, alpha, coronaBoost);
      drawPlanetSphere(ctx, node.x, node.y, r, hsl, alpha, node.id, node.isHub);

      if (isTheme || isSub) {
        const fontSize = Math.max(
          8,
          (node.isHub ? 13 : isSub ? 9 : 11) / globalScale
        );
        const maxChars = node.isHub ? 6 : 4;
        const lines = splitLinesForCircle(node.label, maxChars, 2);
        drawInsideCircle(ctx, lines, node.x, node.y, r, fontSize, alpha, hsl);
      }

      if (active) {
        drawPlanetCorona(ctx, node.x, node.y, r + 8 / globalScale, hsl, alpha, 1.5);
      }
    },
    [highlightId, hoveredId, nodeAlpha, themeColorIndex, graphData.nodes]
  );

  const paintLink = useCallback(
    (link, ctx, globalScale) => {
      const s =
        typeof link.source === 'object' ? link.source : nodeById.get(link.source);
      const t =
        typeof link.target === 'object' ? link.target : nodeById.get(link.target);
      if (!s || !t || !isNodePlaced(s) || !isNodePlaced(t)) {
        return;
      }

      const dim = Math.min(nodeAlpha(s), nodeAlpha(t));
      const themeKey =
        s.parentThemeId ||
        s.themeId ||
        s.clusterId ||
        t.parentThemeId ||
        t.themeId ||
        t.clusterId;
      const colorIdx = themeColorIndex.get(themeKey) ?? 0;
      const hubNode = graphData.nodes.find(
        (n) => n.nodeType === 'theme' && n.clusterId === themeKey
      );
      const hsl = resolveThemeHsl(hubNode?.label || s.clusterLabel, colorIdx);

      if (link.linkType === 'theme') {
        paintEnergyFlow(ctx, s, t, hsl, dim, globalScale, 0.1, 0.85);
        return;
      }

      if (link.linkType === 'theme-sub') {
        paintEnergyFlow(ctx, s, t, hsl, dim, globalScale, 0.05, 0.72);
        return;
      }

      if (link.linkType === 'sub-thought') {
        paintEnergyFlow(ctx, s, t, hsl, dim * 0.9, globalScale, 0.04, 0.48);
        return;
      }

      const sim = link.similarity || 0.78;
      const strong = sim >= HIGH_SIM;
      paintEnergyFlow(ctx, s, t, hsl, dim, globalScale, 0.1, strong ? 0.9 : 0.55);
    },
    [nodeById, nodeAlpha, themeColorIndex, graphData.nodes]
  );

  const linkWidth = useCallback((link) => {
    if (link.linkType === 'theme-sub' || link.linkType === 'sub-thought') {
      return 0.5;
    }
    const sim = link.similarity || 0.78;
    const t = Math.min(1, Math.max(0, (sim - 0.78) / 0.22));
    return 0.35 + t * 2.8;
  }, []);

  const linkColor = useCallback(
    (link) => {
      if (link.linkType === 'theme-sub' || link.linkType === 'sub-thought') {
        return 'rgba(80, 100, 140, 0.04)';
      }
      const sId =
        typeof link.source === 'object' ? link.source.id : link.source;
      const tId =
        typeof link.target === 'object' ? link.target.id : link.target;
      const s = nodeById.get(sId);
      const t = nodeById.get(tId);
      if (
        selectedClusterId &&
        s &&
        t &&
        (s.cluster !== selectedClusterId || t.cluster !== selectedClusterId)
      ) {
        return 'rgba(60, 80, 120, 0.05)';
      }
      const sim = link.similarity || 0.78;
      const strong = sim >= HIGH_SIM;
      const alpha = strong
        ? 0.35 + ((sim - HIGH_SIM) / 0.15) * 0.35
        : 0.06 + ((sim - 0.78) / 0.22) * 0.18;
      return strong
        ? `rgba(150, 170, 255, ${Math.min(0.75, alpha)})`
        : `rgba(100, 130, 200, ${Math.min(0.35, alpha)})`;
    },
    [selectedClusterId, nodeById]
  );

  const handleNodeClick = useCallback(
    (node) => {
      if (node.nodeType === 'theme') {
        onSelectCluster(node.clusterId);
        onSelectThought(null);
      } else if (node.nodeType === 'thought') {
        onSelectThought(node.id);
      }
    },
    [onSelectCluster, onSelectThought]
  );

  return (
    <div className="cosmos-stage" ref={containerRef}>
      {status === 'ready' && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          nodeVal="val"
          nodeLabel={(n) => {
            if (n.nodeType === 'thought') {
              return (n.label || n.name || '').trim() || '思考';
            }
            if (n.nodeType === 'theme') {
              return `${n.label}\n${n.count || 0} 条记录`;
            }
            if (n.nodeType === 'subcluster') {
              return `${n.label}\n${n.count || 0} 条记录`;
            }
            return '';
          }}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            if (!isNodePlaced(node)) {
              return;
            }
            if (node.nodeType === 'thought') {
              const pr = (node.radius || GALAXY.thoughtR) + 6;
              ctx.beginPath();
              ctx.arc(node.x, node.y, pr, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
              return;
            }
            const r = nodeRadiusFor(node) * 1.2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => 'replace'}
          enableNodeDrag={false}
          linkDirectionalArrowLength={0}
          linkDirectionalParticles={0}
          cooldownTicks={0}
          warmupTicks={0}
          onNodeClick={handleNodeClick}
          onNodeHover={(n) => setHoveredId(n ? n.id : null)}
          onBackgroundClick={() => onSelectThought(null)}
        />
      )}
      {(status === 'loading' || status === 'empty' || status === 'error') && (
        <div className="cosmos-overlay" aria-live="polite">
          {status === 'loading' && <div className="cosmos-spinner" />}
          <div className="cosmos-overlay-card">
            <p className="cosmos-overlay-title">
              {status === 'empty'
                ? '这片宇宙还是空的'
                : status === 'error'
                  ? '加载遇到问题'
                  : '正在准备图谱'}
            </p>
            <p className="cosmos-overlay-text">{statusDetail}</p>
            {(status === 'empty' || status === 'error') && (
              <a href="dashboard.html" className="cosmos-overlay-btn">
                回到思维花园
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSidebar({
  meta,
  totalThoughts,
  selectedClusterId,
  onSelectCluster,
  search,
  onSearchChange,
}) {
  const q = search.trim().toLowerCase();
  const filtered = meta.filter((m) =>
    q ? (m.theme || '').toLowerCase().includes(q) : true
  );

  return (
    <aside className="cosmos-sidebar" aria-label="主题星系">
      <div className="cosmos-sidebar-head">
        <h2 className="cosmos-sidebar-title">主题星系</h2>
        <input
          type="search"
          className="cosmos-search"
          placeholder="搜索主题…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="搜索主题"
        />
      </div>
      <div className="cosmos-theme-list">
        <button
          type="button"
          className={`cosmos-theme-item${!selectedClusterId ? ' is-active' : ''}`}
          onClick={() => onSelectCluster(null)}
        >
          <span
            className="cosmos-theme-dot"
            style={{ background: 'hsla(260, 60%, 65%, 0.9)' }}
          />
          <span className="cosmos-theme-name">全部</span>
          <span className="cosmos-theme-count">{totalThoughts}</span>
        </button>
        {filtered.map((m, i) => {
          const hsl = resolveThemeHsl(m.theme, i);
          return (
            <button
              key={m.clusterId}
              type="button"
              className={`cosmos-theme-item${
                selectedClusterId === m.clusterId ? ' is-active' : ''
              }`}
              onClick={() => onSelectCluster(m.clusterId)}
            >
              <span
                className="cosmos-theme-dot"
                style={{ background: hsla(hsl, 0.95) }}
              />
              <span className="cosmos-theme-name">{m.theme}</span>
              <span className="cosmos-theme-count">{m.count}</span>
            </button>
          );
        })}
      </div>
      <div className="cosmos-sidebar-foot">
        <button
          type="button"
          className="cosmos-new-theme"
          onClick={() => {
            window.location.href = 'dashboard.html';
          }}
        >
          + 新建主题
        </button>
      </div>
    </aside>
  );
}

function DetailPanel({
  selectedClusterId,
  highlightId,
  payload,
  gardenId,
  onSelectThought,
  onSelectCluster,
}) {
  const { meta, thoughtById, semanticLinks, thoughts } = payload || {};
  const [followed, setFollowed] = useState(() => new Set());

  const gid = gardenId || getGardenIdFromUrl() || 'garden-default';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOLLOW_KEY_PREFIX + gid);
      setFollowed(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setFollowed(new Set());
    }
  }, [gid]);

  const toggleFollow = useCallback(() => {
    if (!selectedClusterId) {
      return;
    }
    const next = new Set(followed);
    if (next.has(selectedClusterId)) {
      next.delete(selectedClusterId);
    } else {
      next.add(selectedClusterId);
    }
    setFollowed(next);
    try {
      localStorage.setItem(
        FOLLOW_KEY_PREFIX + gid,
        JSON.stringify([...next])
      );
    } catch {
      /* ignore */
    }
  }, [followed, selectedClusterId, gid]);

  const getRelated = useMemo(() => {
    if (!meta?.length) {
      return () => [];
    }
    if (
      typeof MindTraceThemeGalaxyService !== 'undefined' &&
      typeof MindTraceThemeGalaxyService.buildThemeRelations === 'function'
    ) {
      return MindTraceThemeGalaxyService.buildThemeRelations(
        meta,
        semanticLinks || []
      );
    }
    return () => [];
  }, [meta, semanticLinks]);

  if (!selectedClusterId) {
    const total = thoughts?.length || 0;
    return (
      <div className="cosmos-detail-inner">
        <p className="cosmos-detail-tag">思维宇宙</p>
        <h2 className="cosmos-detail-title">全部主题星系</h2>
        <p className="cosmos-detail-stats">
          {meta?.length || 0} 个主题 · {total} 条思考
        </p>
        <p className="cosmos-detail-desc">
          这是你的思维结构鸟瞰。点选左侧某一主题，或点击图谱中的主题大圆，查看该方向上的思考与主题之间的关联。
        </p>
        <div className="cosmos-detail-section">
          <h3 className="cosmos-detail-section-title">主题一览</h3>
          <ul className="cosmos-thought-list">
            {(meta || []).map((m, i) => (
              <li key={m.clusterId}>
                <button
                  type="button"
                  className="cosmos-thought-item"
                  onClick={() => onSelectCluster && onSelectCluster(m.clusterId)}
                >
                  <span className="cosmos-thought-item-title">
                    <span
                      className="cosmos-thought-bullet"
                      style={{
                        background: hsla(resolveThemeHsl(m.theme, i), 0.9),
                      }}
                    />
                    {m.theme}
                    <span className="cosmos-theme-count-inline">
                      {m.count}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const cluster = meta?.find((m) => m.clusterId === selectedClusterId);

  if (!cluster) {
    return (
      <div className="cosmos-detail-inner">
        <p className="cosmos-detail-empty">
          选择左侧主题或点击图谱中的节点，查看你的想法如何彼此连接。
        </p>
      </div>
    );
  }

  const idx = meta.findIndex((m) => m.clusterId === cluster.clusterId);
  const hsl = resolveThemeHsl(cluster.theme, idx);
  const members = (cluster.recordIds || [])
    .map((id) => thoughtById.get(id))
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const lastUpdated = members[0]?.createdAt;
  const related = getRelated(cluster.clusterId);
  const topStrength =
    related[0]?.score ||
    (members.length > 1 ? 0.72 : 0.45);

  const dashboardFilterUrl = `dashboard.html?garden=${encodeURIComponent(gid)}`;

  return (
    <>
      <div className="cosmos-detail-inner">
        <p className="cosmos-detail-tag">
          <span
            className="cosmos-detail-tag-dot"
            style={{ background: hsla(hsl, 0.95) }}
          />
          主题聚类
        </p>
        <h2 className="cosmos-detail-title">
          {cluster.theme}
          <span className="cosmos-detail-badge">主题星系</span>
        </h2>
        <p className="cosmos-detail-stats">
          {cluster.count} 个相关思考
          {lastUpdated ? ` · 更新于 ${formatNodeDate(lastUpdated)}` : ''}
        </p>
        <p className="cosmos-detail-desc">
          {cluster.description || themeDescription(cluster.theme)}
        </p>

        {cluster.keywords && cluster.keywords.length > 0 && (
          <div className="cosmos-detail-section">
            <h3 className="cosmos-detail-section-title">关键词</h3>
            <div className="cosmos-keywords">
              {cluster.keywords.map((kw) => (
                <span key={kw} className="cosmos-keyword-pill">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="cosmos-detail-section">
          <h3 className="cosmos-detail-section-title">关联强度</h3>
          <div className="cosmos-strength-bar">
            <div
              className="cosmos-strength-fill"
              style={{ width: `${Math.min(100, topStrength * 100)}%` }}
            />
          </div>
          <p className="cosmos-strength-label">{strengthLabel(topStrength)}</p>
        </div>

        {related.length > 0 && (
          <div className="cosmos-detail-section">
            <h3 className="cosmos-detail-section-title">关联最强主题</h3>
            {related.map((r) => (
              <div key={r.clusterId} className="cosmos-related-item">
                <span>{r.theme}</span>
                <span className="cosmos-related-score">
                  相关度 {r.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="cosmos-detail-section">
          <h3 className="cosmos-detail-section-title">最近思考</h3>
          <ul className="cosmos-thought-list">
            {members.slice(0, 5).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`cosmos-thought-item${
                    highlightId === t.id ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    if (onSelectThought) {
                      onSelectThought(t.id);
                    }
                  }}
                  onDoubleClick={() => openThoughtInGarden(t.id, gardenId)}
                >
                  <span className="cosmos-thought-item-title">
                    <span
                      className="cosmos-thought-bullet"
                      style={{ background: hsla(hsl, 0.9) }}
                    />
                    {MindTraceGraphService.extractLabel(t)}
                  </span>
                  <span className="cosmos-thought-item-date">
                    {formatNodeDate(t.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="cosmos-detail-actions">
        <a href={dashboardFilterUrl} className="cosmos-btn cosmos-btn--primary">
          查看全部记录 →
        </a>
        <button
          type="button"
          className={`cosmos-btn cosmos-btn--ghost cosmos-btn--follow${
            followed.has(cluster.clusterId) ? ' is-followed' : ''
          }`}
          onClick={toggleFollow}
        >
          {followed.has(cluster.clusterId) ? '★ 已关注主题' : '☆ 设为关注主题'}
        </button>
      </div>
    </>
  );
}

function App() {
  const gardenId = useMemo(() => getGardenIdFromUrl(), []);
  const [gardenLabel, setGardenLabel] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [payload, setPayload] = useState({
    meta: [],
    thoughtById: new Map(),
    semanticLinks: [],
    metrics: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadLabel() {
      if (typeof MindTraceGardenService === 'undefined') {
        return;
      }
      try {
        const id =
          gardenId || (await MindTraceGardenService.getCurrentGardenId());
        const gardens = await MindTraceGardenService.getGardens();
        const g = gardens.find((item) => item.id === id);
        if (!cancelled) {
          setGardenLabel(g ? g.name : '');
        }
      } catch {
        /* ignore */
      }
    }
    loadLabel();
    return () => {
      cancelled = true;
    };
  }, [gardenId]);

  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      gardenId: gardenId || getGardenIdFromUrl(),
      gardenLabel,
      metrics: payload.metrics,
      clusters: payload.meta,
      thoughtCount: payload.thoughts?.length || 0,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mindtrace-cosmos-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [gardenId, gardenLabel, payload]);

  const metrics = payload.metrics || {
    thoughts: 0,
    links: 0,
    themes: 0,
    density: 0,
  };

  const dashboardHref = gardenId
    ? `dashboard.html?garden=${encodeURIComponent(gardenId)}`
    : 'dashboard.html';

  return (
    <div className="cosmos-app">
      <header className="cosmos-header">
        <div className="cosmos-header-brand">
          <span className="cosmos-header-icon" aria-hidden="true">
            🌌
          </span>
          <div>
            <h1 className="cosmos-title">思维宇宙</h1>
            <p className="cosmos-sub">
              {gardenLabel
                ? `当前花园：${gardenLabel} · 发现想法之间隐藏的联系`
                : '发现想法之间隐藏的联系'}
            </p>
          </div>
        </div>
        <div className="cosmos-header-actions">
          <a href={dashboardHref} className="cosmos-btn">
            ← 返回思维花园
          </a>
          <button
            type="button"
            className="cosmos-btn cosmos-btn--primary"
            onClick={handleExport}
            disabled={!payload.metrics}
          >
            导出图谱
          </button>
        </div>
      </header>

      <div className="cosmos-body-grid">
        <ThemeSidebar
          meta={payload.meta}
          totalThoughts={payload.thoughts?.length || 0}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
          search={search}
          onSearchChange={setSearch}
        />

        <section className="cosmos-center" aria-label="宇宙图谱">
          <div className="cosmos-map-vignette" aria-hidden="true" />
          <div className="cosmos-nebula" aria-hidden="true" />
          <div className="cosmos-stars" aria-hidden="true" />
          <div className="cosmos-dust" aria-hidden="true" />
          <div className="cosmos-metrics">
            <div className="cosmos-metric">
              <div className="cosmos-metric-value">{metrics.thoughts}</div>
              <div className="cosmos-metric-label">思考节点</div>
            </div>
            <div className="cosmos-metric">
              <div className="cosmos-metric-value">{metrics.links}</div>
              <div className="cosmos-metric-label">关联关系</div>
            </div>
            <div className="cosmos-metric">
              <div className="cosmos-metric-value">{metrics.themes}</div>
              <div className="cosmos-metric-label">主题数量</div>
            </div>
            <div className="cosmos-metric">
              <div className="cosmos-metric-value">
                {metrics.density.toFixed(2)}
              </div>
              <div className="cosmos-metric-label">网络密度</div>
            </div>
          </div>
          <div className="cosmos-graph-wrap">
            <CosmosGraph
              selectedClusterId={selectedClusterId}
              onSelectCluster={setSelectedClusterId}
              onSelectThought={setHighlightId}
              highlightId={highlightId}
              hoveredId={hoveredId}
              setHoveredId={setHoveredId}
              gardenId={gardenId}
              onDataLoaded={(data) => {
              setPayload({
                thoughts: data.thoughts,
                meta: data.meta,
                thoughtById: data.thoughtById,
                semanticLinks: data.semanticLinks,
                metrics: data.metrics,
              });
                if (data.meta?.length && !selectedClusterId) {
                  setSelectedClusterId(data.meta[0].clusterId);
                }
              }}
            />
          <p className="cosmos-graph-hint">
            中心主题 → 主题簇 → 记录 · 拖动平移 · 滚轮缩放 · 悬停记录看全文
          </p>
          </div>
        </section>

        <aside className="cosmos-detail" aria-label="主题详情">
          <DetailPanel
            selectedClusterId={selectedClusterId}
            highlightId={highlightId}
            payload={payload}
            gardenId={gardenId}
            onSelectThought={setHighlightId}
            onSelectCluster={setSelectedClusterId}
          />
        </aside>
      </div>
    </div>
  );
}

function showGraphBootError(message) {
  const box = document.getElementById('graph-boot-error');
  if (box) {
    box.hidden = false;
    box.textContent = message;
  }
}

window.addEventListener('error', (e) => {
  if (!e.filename || e.filename.indexOf('graph.bundle') === -1) {
    return;
  }
  showGraphBootError(
    '思维宇宙运行出错，请在 chrome://extensions 重新加载 MindTrace 后重试。'
  );
});

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error('[MindTrace Graph] boot failed:', err);
    showGraphBootError(
      '思维宇宙启动失败，请在 chrome://extensions 重新加载 MindTrace 后重试。'
    );
  }
}
