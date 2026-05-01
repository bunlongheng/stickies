"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Note {
  id: string;
  title: string;
  folder_name: string;
  folder_color: string;
  updated_at: string;
  content?: string;
}

interface GraphViewProps {
  notes: Note[];
  folders: { name: string; color: string }[];
  onOpenNote: (note: Note) => void;
  theme: "light" | "dark";
}

interface Node {
  id: string;
  title: string;
  folder: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

function tokenize(text: string): Set<string> {
  return new Set((text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3));
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / Math.sqrt(a.size * b.size);
}

export function GraphView({ notes, folders, onOpenNote, theme }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const dragRef = useRef<{ node: string; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Build graph on mount / notes change
  useEffect(() => {
    if (!notes.length) return;
    const w = canvasRef.current?.parentElement?.clientWidth || 800;
    const h = canvasRef.current?.parentElement?.clientHeight || 600;
    sizeRef.current = { w, h };

    // Group by folder
    const folderMap = new Map<string, Note[]>();
    notes.forEach(n => {
      const f = n.folder_name || "General";
      if (!folderMap.has(f)) folderMap.set(f, []);
      folderMap.get(f)!.push(n);
    });

    // Position nodes in folder clusters
    const folderNames = Array.from(folderMap.keys());
    const nodes: Node[] = [];
    const cx = w / 2, cy = h / 2;
    const clusterRadius = Math.min(w, h) * 0.35;

    folderNames.forEach((fname, fi) => {
      const angle = (fi / folderNames.length) * Math.PI * 2 - Math.PI / 2;
      const fcx = cx + Math.cos(angle) * clusterRadius;
      const fcy = cy + Math.sin(angle) * clusterRadius;
      const fnotes = folderMap.get(fname)!;
      const fc = folders.find(f => f.name === fname)?.color || "#888";

      fnotes.forEach((n, ni) => {
        const na = (ni / fnotes.length) * Math.PI * 2;
        const nr = Math.min(40 + fnotes.length * 3, 100);
        nodes.push({
          id: n.id,
          title: (n.title || "Untitled").slice(0, 30),
          folder: fname,
          color: n.folder_color || fc,
          x: fcx + Math.cos(na) * nr + (Math.random() - 0.5) * 20,
          y: fcy + Math.sin(na) * nr + (Math.random() - 0.5) * 20,
          vx: 0, vy: 0,
          radius: 6,
        });
      });
    });

    // Build edges based on content similarity
    const tokenSets = new Map<string, Set<string>>();
    notes.forEach(n => tokenSets.set(n.id, tokenize(`${n.title || ""} ${n.content || ""}`)));

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // Same folder = weak link
        if (nodes[i].folder === nodes[j].folder) {
          edges.push({ source: nodes[i].id, target: nodes[j].id, weight: 0.3 });
          continue;
        }
        const sim = similarity(tokenSets.get(nodes[i].id)!, tokenSets.get(nodes[j].id)!);
        if (sim > 0.15) {
          edges.push({ source: nodes[i].id, target: nodes[j].id, weight: sim });
        }
      }
    }

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [notes, folders]);

  // Physics simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const render = () => {
      const { w, h } = sizeRef.current;
      canvas.width = w * 2; canvas.height = h * 2;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(offsetRef.current.x + w / 2, offsetRef.current.y + h / 2);
      ctx.scale(scaleRef.current, scaleRef.current);
      ctx.translate(-w / 2, -h / 2);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const isDark = theme === "dark";

      // Simple force simulation step
      for (const n of nodes) {
        // Repulsion
        for (const m of nodes) {
          if (n.id === m.id) continue;
          const dx = n.x - m.x, dy = n.y - m.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 200 / (d * d);
          n.vx += (dx / d) * force;
          n.vy += (dy / d) * force;
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (d - 80) * 0.005 * e.weight;
        s.vx += (dx / d) * force;
        s.vy += (dy / d) * force;
        t.vx -= (dx / d) * force;
        t.vy -= (dy / d) * force;
      }
      // Apply velocity with damping
      for (const n of nodes) {
        if (dragRef.current?.node === n.id) continue;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
      }

      // Draw edges
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = isDark ? `rgba(255,255,255,${0.03 + e.weight * 0.1})` : `rgba(0,0,0,${0.03 + e.weight * 0.1})`;
        ctx.lineWidth = 0.5 + e.weight * 1.5;
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const isHovered = hoveredNode === n.id;
        const isSelected = selectedNode === n.id;
        const r = isSelected ? n.radius * 2 : isHovered ? n.radius * 1.5 : n.radius;

        // Glow
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx.fillStyle = `${n.color}44`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        if (isHovered || isSelected || scaleRef.current > 1.2) {
          ctx.font = `bold ${isSelected ? 11 : 9}px -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = isDark ? "#fff" : "#1a1a1a";
          ctx.fillText(n.title, n.x, n.y + r + 12);
          ctx.font = `8px -apple-system, sans-serif`;
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
          ctx.fillText(n.folder, n.x, n.y + r + 22);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [theme, hoveredNode, selectedNode]);

  // Resize
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getNodeAt = useCallback((mx: number, my: number): Node | null => {
    const { w, h } = sizeRef.current;
    const s = scaleRef.current;
    const tx = (mx - offsetRef.current.x - w / 2) / s + w / 2;
    const ty = (my - offsetRef.current.y - h / 2) / s + h / 2;
    for (const n of nodesRef.current) {
      const dx = n.x - tx, dy = n.y - ty;
      if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  }, []);

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: theme === "dark" ? "#0a0a0a" : "#f8f8f8" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          if (dragRef.current) {
            const node = nodesRef.current.find(n => n.id === dragRef.current!.node);
            if (node) {
              const s = scaleRef.current;
              const { w, h } = sizeRef.current;
              node.x = (mx - offsetRef.current.x - w / 2) / s + w / 2;
              node.y = (my - offsetRef.current.y - h / 2) / s + h / 2;
              node.vx = 0; node.vy = 0;
            }
            return;
          }
          if (panRef.current) {
            offsetRef.current.x = panRef.current.ox + (mx - panRef.current.startX);
            offsetRef.current.y = panRef.current.oy + (my - panRef.current.startY);
            return;
          }
          const n = getNodeAt(mx, my);
          setHoveredNode(n?.id || null);
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          const n = getNodeAt(mx, my);
          if (n) {
            dragRef.current = { node: n.id, startX: mx, startY: my };
          } else {
            panRef.current = { startX: mx, startY: my, ox: offsetRef.current.x, oy: offsetRef.current.y };
          }
        }}
        onMouseUp={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          if (dragRef.current) {
            const moved = Math.abs(mx - dragRef.current.startX) + Math.abs(my - dragRef.current.startY);
            if (moved < 5) {
              // Click — zoom in and select
              const n = nodesRef.current.find(nd => nd.id === dragRef.current!.node);
              if (n) {
                setSelectedNode(prev => prev === n.id ? null : n.id);
                if (selectedNode !== n.id) {
                  scaleRef.current = Math.min(scaleRef.current * 1.5, 4);
                  const { w, h } = sizeRef.current;
                  offsetRef.current.x = w / 2 - n.x * scaleRef.current + (scaleRef.current - 1) * w / 2;
                  offsetRef.current.y = h / 2 - n.y * scaleRef.current + (scaleRef.current - 1) * h / 2;
                }
              }
            }
            dragRef.current = null;
          }
          panRef.current = null;
        }}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
          if (n) {
            const note = notes.find(nt => nt.id === n.id);
            if (note) onOpenNote(note);
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          scaleRef.current = Math.max(0.3, Math.min(5, scaleRef.current * delta));
        }}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 text-[9px] font-bold" style={{ color: theme === "dark" ? "#888" : "#666" }}>
        {Array.from(new Set(notes.map(n => n.folder_name || "General"))).slice(0, 8).map(f => {
          const c = folders.find(fd => fd.name === f)?.color || "#888";
          return <span key={f} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{f}</span>;
        })}
      </div>
      <div className="absolute top-3 right-3 text-[9px] font-bold" style={{ color: theme === "dark" ? "#555" : "#999" }}>
        Scroll to zoom / Drag to pan / Click node to focus / Double-click to open
      </div>
    </div>
  );
}
