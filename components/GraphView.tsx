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
  radius: number;
  isFolder: boolean;
}

export function GraphView({ notes, folders, onOpenNote, theme }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Build static layout — folders in circle, notes branching out
  useEffect(() => {
    if (!notes.length) return;
    const w = canvasRef.current?.parentElement?.clientWidth || 800;
    const h = canvasRef.current?.parentElement?.clientHeight || 600;
    sizeRef.current = { w, h };

    const folderMap = new Map<string, Note[]>();
    notes.forEach(n => {
      const f = n.folder_name || "General";
      if (!folderMap.has(f)) folderMap.set(f, []);
      folderMap.get(f)!.push(n);
    });

    const folderNames = Array.from(folderMap.keys());
    const nodes: Node[] = [];
    const cx = w / 2, cy = h / 2;
    const clusterRadius = Math.min(w, h) * 0.3;

    // Root node
    nodes.push({ id: "__root__", title: "ROOT", folder: "", color: theme === "dark" ? "#fff" : "#1a1a1a", x: cx, y: cy, radius: 12, isFolder: true });

    // Folder nodes in a circle around root
    folderNames.forEach((fname, fi) => {
      const angle = (fi / folderNames.length) * Math.PI * 2 - Math.PI / 2;
      const fx = cx + Math.cos(angle) * clusterRadius;
      const fy = cy + Math.sin(angle) * clusterRadius;
      const fc = folders.find(f => f.name === fname)?.color || "#888";
      const noteCount = folderMap.get(fname)!.length;

      nodes.push({ id: `folder:${fname}`, title: fname, folder: fname, color: fc, x: fx, y: fy, radius: 8 + Math.min(noteCount, 20) * 0.5, isFolder: true });

      // Note nodes branching from folder
      const fnotes = folderMap.get(fname)!;
      const noteRadius = 30 + Math.min(fnotes.length * 4, 80);
      fnotes.forEach((n, ni) => {
        const na = angle + ((ni - fnotes.length / 2) / Math.max(fnotes.length, 1)) * 1.2;
        nodes.push({
          id: n.id,
          title: (n.title || "Untitled").slice(0, 25),
          folder: fname,
          color: n.folder_color || fc,
          x: fx + Math.cos(na) * noteRadius,
          y: fy + Math.sin(na) * noteRadius,
          radius: 4,
          isFolder: false,
        });
      });
    });

    nodesRef.current = nodes;
  }, [notes, folders, theme]);

  // Render loop (no physics — static positions)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const render = () => {
      const { w, h } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(offsetRef.current.x + w / 2, offsetRef.current.y + h / 2);
      ctx.scale(scaleRef.current, scaleRef.current);
      ctx.translate(-w / 2, -h / 2);

      const nodes = nodesRef.current;
      const isDark = theme === "dark";
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const root = nodeMap.get("__root__");

      // Draw edges: root → folders
      for (const n of nodes) {
        if (n.id.startsWith("folder:") && root) {
          ctx.beginPath();
          ctx.moveTo(root.x, root.y);
          ctx.lineTo(n.x, n.y);
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw edges: folders → notes
      for (const n of nodes) {
        if (!n.isFolder) {
          const parent = nodeMap.get(`folder:${n.folder}`);
          if (parent) {
            ctx.beginPath();
            ctx.moveTo(parent.x, parent.y);
            ctx.lineTo(n.x, n.y);
            ctx.strokeStyle = isDark ? `${n.color}30` : `${n.color}25`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const isHovered = hoveredNode === n.id;
        const isSelected = selectedNode === n.id;
        const r = isSelected ? n.radius * 2 : isHovered ? n.radius * 1.5 : n.radius;

        // Glow
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = `${n.color}33`;
          ctx.fill();
        }

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.isFolder) {
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Labels — always show for folders, hover/zoom for notes
        if (n.isFolder || isHovered || isSelected || scaleRef.current > 1.5) {
          ctx.font = `bold ${n.isFolder ? 11 : 9}px -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = isDark ? "#fff" : "#1a1a1a";
          ctx.fillText(n.title, n.x, n.y + r + 14);
          if (!n.isFolder && n.id !== "__root__") {
            ctx.font = "7px -apple-system, sans-serif";
            ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
            ctx.fillText(n.folder, n.x, n.y + r + 22);
          }
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
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
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
      const hitR = Math.max(n.radius + 4, 8);
      if (dx * dx + dy * dy < hitR * hitR) return n;
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
          if (panRef.current) {
            offsetRef.current.x = panRef.current.ox + (mx - panRef.current.startX);
            offsetRef.current.y = panRef.current.oy + (my - panRef.current.startY);
            return;
          }
          const n = getNodeAt(mx, my);
          setHoveredNode(n?.id || null);
          e.currentTarget.style.cursor = n ? "pointer" : "grab";
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          const n = getNodeAt(mx, my);
          if (!n) {
            panRef.current = { startX: mx, startY: my, ox: offsetRef.current.x, oy: offsetRef.current.y };
          }
        }}
        onMouseUp={(e) => {
          if (panRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const moved = Math.abs(mx - panRef.current.startX) + Math.abs(my - panRef.current.startY);
            panRef.current = null;
            if (moved > 5) return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
          if (n) {
            if (n.id === "__root__") { setSelectedNode(null); scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; return; }
            setSelectedNode(prev => prev === n.id ? null : n.id);
            // Zoom toward clicked node
            const { w, h } = sizeRef.current;
            const targetScale = n.isFolder ? 1.8 : 2.5;
            scaleRef.current = targetScale;
            offsetRef.current.x = w / 2 - n.x * targetScale + (targetScale - 1) * w / 2;
            offsetRef.current.y = h / 2 - n.y * targetScale + (targetScale - 1) * h / 2;
          }
        }}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
          if (n && !n.isFolder && n.id !== "__root__") {
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
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 text-[9px] font-bold pointer-events-none" style={{ color: theme === "dark" ? "#888" : "#666" }}>
        {Array.from(new Set(notes.map(n => n.folder_name || "General"))).slice(0, 10).map(f => {
          const c = folders.find(fd => fd.name === f)?.color || "#888";
          return <span key={f} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{f}</span>;
        })}
      </div>
      <div className="absolute top-3 right-3 text-[8px] font-bold pointer-events-none" style={{ color: theme === "dark" ? "#444" : "#bbb" }}>
        Scroll zoom / Drag pan / Click focus / Double-click open
      </div>
    </div>
  );
}
