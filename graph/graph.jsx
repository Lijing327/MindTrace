/**
 * MindTrace — 思维宇宙（react-force-graph 认知图谱）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ForceGraph2D } from 'react-force-graph';

const BG = '#050816';
const CLUSTER_HUES = [210, 255, 280, 195, 240, 265, 225];

function clusterHue(clusterId) {
  const m = /cluster-(\d+)/.exec(clusterId || '');
  const idx = m ? parseInt(m[1], 10) : 0;
  return CLUSTER_HUES[idx % CLUSTER_HUES.length];
}

function nodeRadius(node) {
  return Math.sqrt(node.val || 4) * 2.8 + 3;
}

function CosmosGraph() {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [status, setStatus] = useState('loading');
  const [statusDetail, setStatusDetail] = useState('正在载入思考…');
  const [highlightId, setHighlightId] = useState(null);

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

        const needsEmb = thoughts.filter((item) => {
          const text =
            typeof MindTraceEmbeddingService !== 'undefined'
              ? MindTraceEmbeddingService.getTextForEmbedding(item)
              : (item.note || item.selectedText || '').trim();
          return text && (!item.embedding || !item.embedding.length);
        });

        if (
          needsEmb.length &&
          typeof MindTraceEmbeddingService !== 'undefined'
        ) {
          setStatusDetail(
            `正在为 ${needsEmb.length} 条思考建立语义连结…`
          );
          try {
            await MindTraceEmbeddingService.backfillMissing(needsEmb);
          } catch (err) {
            console.warn('[MindTrace Graph] embedding backfill:', err);
          }
          if (cancelled) {
            return;
          }
          const refreshed = await MindTraceStorage.getAllRaw();
          thoughts.splice(0, thoughts.length, ...refreshed);
        }

        const raw = MindTraceGraphService.buildGraph(thoughts);
        const nodes = raw.nodes.map((n) => ({
          ...n,
          val: n.weight,
          name: n.label,
        }));
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
    if (status !== 'ready' || !fgRef.current) {
      return;
    }
    const charge = fgRef.current.d3Force('charge');
    if (charge) {
      charge.strength(-120);
    }
    const link = fgRef.current.d3Force('link');
    if (link) {
      link.distance(90);
    }
    fgRef.current.d3VelocityDecay(0.12);
  }, [status, graphData]);

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const r = nodeRadius(node) / globalScale;
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
    return `${nodeCount} 个神经元 · ${linkCount} 条语义连结`;
  }, [status, statusDetail, nodeCount, linkCount]);

  return (
    <div className="cosmos-stage" ref={containerRef}>
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
            <p className="cosmos-sub">认知图谱 · 语义神经元</p>
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
  createRoot(rootEl).render(<App />);
}
