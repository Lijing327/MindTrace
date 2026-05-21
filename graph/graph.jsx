/**
 * MindTrace — 思维宇宙（react-force-graph 认知图谱）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ForceGraph2D from 'react-force-graph-2d';

const BG = '#050816';
const CLUSTER_HUES = [210, 255, 280, 195, 240, 265, 225];
const GUIDE_DISMISS_KEY = 'mindtrace_cosmos_guide_dismissed';

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

function openThoughtInGarden(thoughtId) {
  if (!thoughtId) {
    return;
  }
  window.location.href = `dashboard.html?thought=${encodeURIComponent(thoughtId)}`;
}

function clusterHue(clusterId) {
  const m = /cluster-(\d+)/.exec(clusterId || '');
  const idx = m ? parseInt(m[1], 10) : 0;
  return CLUSTER_HUES[idx % CLUSTER_HUES.length];
}

function nodeRadius(node) {
  return Math.sqrt(node.val || 4) * 2.8 + 3;
}

function isNodePlaced(node) {
  return (
    node &&
    Number.isFinite(node.x) &&
    Number.isFinite(node.y)
  );
}

function CosmosGraph() {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [status, setStatus] = useState('loading');
  const [statusDetail, setStatusDetail] = useState('正在载入思考…');
  const [highlightId, setHighlightId] = useState(null);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_DISMISS_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const resize = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setSize({
      w: Math.max(320, Math.floor(rect.width)),
      h: Math.max(320, Math.floor(rect.height)),
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
      setStatusDetail('正在载入思考…');

      try {
        const thoughts = await MindTraceStorage.getAllRaw();

        if (!thoughts.length) {
          if (!cancelled) {
            setGraphData({ nodes: [], links: [] });
            setStatus('empty');
            setStatusDetail('');
          }
          return;
        }

        const raw = MindTraceGraphService.buildGraph(thoughts);
        const rect = containerRef.current?.getBoundingClientRect();
        const cx = rect ? Math.max(160, rect.width / 2) : 400;
        const cy = rect ? Math.max(160, rect.height / 2) : 300;
        const spread = Math.min(180, 48 + raw.nodes.length * 10);
        const nodes = raw.nodes.map((n, index, arr) => {
          const angle = (index / Math.max(1, arr.length)) * Math.PI * 2;
          return {
            ...n,
            val: n.weight,
            name: n.label,
            x: cx + Math.cos(angle) * spread,
            y: cy + Math.sin(angle) * spread,
          };
        });
        const links = raw.links.map((l) => ({ ...l }));

        if (!cancelled) {
          setGraphData({ nodes, links });
          setStatus(nodes.length ? 'ready' : 'empty');
          setStatusDetail('');
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
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (status !== 'ready' || !fg || typeof fg.d3Force !== 'function') {
      return;
    }
    try {
      const charge = fg.d3Force('charge');
      if (charge && typeof charge.strength === 'function') {
        charge.strength(-120);
      }
      const link = fg.d3Force('link');
      if (link && typeof link.distance === 'function') {
        link.distance(90);
      }
      if (typeof fg.d3ReheatSimulation === 'function') {
        fg.d3ReheatSimulation();
      }
      if (typeof fg.zoomToFit === 'function' && graphData.nodes.length > 0) {
        window.setTimeout(() => {
          try {
            fg.zoomToFit(480, 48);
          } catch (err) {
            console.warn('[MindTrace Graph] zoomToFit failed:', err);
          }
        }, 600);
      }
    } catch (err) {
      console.warn('[MindTrace Graph] force layout tweak failed:', err);
    }
  }, [status, graphData]);

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      if (!isNodePlaced(node) || !Number.isFinite(globalScale) || globalScale <= 0) {
        return;
      }

      const r = nodeRadius(node) / globalScale;
      if (!Number.isFinite(r) || r <= 0) {
        return;
      }

      const hue = clusterHue(node.cluster);
      const glow = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        r * 2.4
      );
      glow.addColorStop(0, `hsla(${hue}, 90%, 72%, 0.95)`);
      glow.addColorStop(0.45, `hsla(${hue + 25}, 85%, 58%, 0.55)`);
      glow.addColorStop(1, `hsla(${hue + 40}, 70%, 40%, 0)`);

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = glow;
      ctx.fill();

      const core = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        r * 0.55
      );
      core.addColorStop(0, `hsla(${hue}, 100%, 88%, 1)`);
      core.addColorStop(1, `hsla(${hue + 15}, 90%, 65%, 0.85)`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.42, 0, 2 * Math.PI, false);
      ctx.fillStyle = core;
      ctx.fill();

      if (highlightId === node.id) {
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.9)';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.15, 0, 2 * Math.PI, false);
        ctx.stroke();
      }
    },
    [highlightId]
  );

  const linkWidth = useCallback((link) => {
    const sim = link.similarity || 0.78;
    const t = Math.min(1, Math.max(0, (sim - 0.78) / 0.22));
    return 0.4 + t * 2.2;
  }, []);

  const linkColor = useCallback((link) => {
    const sim = link.similarity || 0.78;
    const alpha = 0.12 + ((sim - 0.78) / 0.22) * 0.38;
    return `rgba(130, 170, 255, ${Math.min(0.55, Math.max(0.08, alpha))})`;
  }, []);

  const nodeCount = graphData.nodes.length;
  const linkCount = graphData.links.length;

  const selectedNode = useMemo(() => {
    if (!highlightId) {
      return null;
    }
    return graphData.nodes.find((n) => n.id === highlightId) || null;
  }, [highlightId, graphData.nodes]);

  const dismissGuide = useCallback(() => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const hint = useMemo(() => {
    if (status === 'empty') {
      return '还没有可绘制的思考，去网页划词记录吧';
    }
    if (status === 'error') {
      return statusDetail;
    }
    if (status === 'loading') {
      return statusDetail;
    }
    return `${nodeCount} 个思考 · ${linkCount} 条关联 · 点击节点可在思维花园查看`;
  }, [status, statusDetail, nodeCount, linkCount]);

  return (
    <div className="cosmos-stage" ref={containerRef}>
      {status === 'ready' && guideOpen && (
        <aside className="cosmos-guide" aria-label="使用说明">
          <p className="cosmos-guide-title">这是你的思考关系图</p>
          <ul className="cosmos-guide-list">
            <li>
              <strong>圆点</strong> = 一条思考，<strong>连线</strong> = 意思相近或关键词相关
            </li>
            <li>拖动画布平移，滚轮缩放，悬停看摘要</li>
            <li>
              <strong>点击节点</strong> 选中，再点「在思维花园中查看」打开笔记
            </li>
          </ul>
          <button
            type="button"
            className="cosmos-guide-dismiss"
            onClick={dismissGuide}
          >
            知道了
          </button>
        </aside>
      )}
      {status === 'ready' && selectedNode && (
        <aside className="cosmos-selection" aria-label="已选思考">
          <p className="cosmos-selection-label">已选中</p>
          <p className="cosmos-selection-title">
            {selectedNode.label || selectedNode.name || '（未命名思考）'}
          </p>
          <p className="cosmos-selection-meta">
            {selectedNode.cluster || '未分主题'} · 关联 {selectedNode.degree || 0}
            {selectedNode.createdAt
              ? ` · ${formatNodeDate(selectedNode.createdAt)}`
              : ''}
          </p>
          <button
            type="button"
            className="cosmos-selection-btn"
            onClick={() => openThoughtInGarden(selectedNode.id)}
          >
            在思维花园中查看 →
          </button>
          <button
            type="button"
            className="cosmos-selection-clear"
            onClick={() => setHighlightId(null)}
          >
            取消选择
          </button>
        </aside>
      )}
      {status === 'ready' && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graphData}
          backgroundColor={BG}
          nodeRelSize={1}
          nodeVal="val"
          nodeLabel={(n) =>
            `${n.label || n.name}\n${n.cluster || ''} · 关联 ${n.degree || 0}`
          }
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            if (!isNodePlaced(node)) {
              return;
            }
            const r = nodeRadius(node) * 1.4;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkDirectionalArrowLength={0}
          linkDirectionalParticles={0}
          cooldownTicks={120}
          warmupTicks={80}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.12}
          onNodeClick={(node) => setHighlightId(node.id)}
          onBackgroundClick={() => setHighlightId(null)}
        />
      )}
      {(status === 'loading' || status === 'empty' || status === 'error') && (
        <div className="cosmos-overlay" aria-live="polite">
          {status === 'loading' && <div className="cosmos-spinner" />}
          <p className="cosmos-overlay-text">{hint}</p>
        </div>
      )}
      {status === 'ready' && (
        <p className="cosmos-hint-bar" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="cosmos-app">
      <header className="cosmos-header">
        <div className="cosmos-header-inner">
          <div>
            <h1 className="cosmos-title">思维宇宙</h1>
            <p className="cosmos-sub">
              看见想法之间的关联 · 点击节点回到思维花园
            </p>
          </div>
          <nav className="cosmos-nav">
            <a href="dashboard.html" className="cosmos-link">
              ← 思维花园
            </a>
          </nav>
        </div>
      </header>
      <main className="cosmos-main">
        <CosmosGraph />
      </main>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error('[MindTrace Graph] boot failed:', err);
    rootEl.innerHTML =
      '<div class="cosmos-overlay" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#c8d4f0;background:#050816"><p>思维宇宙启动失败，请在 chrome://extensions 重新加载 MindTrace 后重试。</p></div>';
  }
}
