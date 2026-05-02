"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Note { id: string; title: string; folder_name: string; folder_color: string; updated_at: string; }
interface Folder { name: string; color: string; parent?: string | null; }

interface GraphViewProps {
  notes: Note[];
  folders: Folder[];
  folderIcons?: Record<string, string>;
  onOpenNote: (note: Note) => void;
  onClickFolder?: (folderName: string) => void;
  theme: "light" | "dark";
}

interface GNode {
  id: string;
  baseX: number; baseY: number;
  r: number;
  color: string;
  label: string;
  type: "center" | "folder" | "note";
  folderName?: string;
  initial: string;
  phX: number; phY: number;
  spX: number; spY: number;
  amp: number;
}

export function GraphView({ notes, folders, onOpenNote, onClickFolder, theme }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const posRef = useRef<{ x: number; y: number }[]>([]);
  const tRef = useRef(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GNode } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const targetPanRef = useRef({ x: 0, y: 0 });
  const targetScaleRef = useRef(1);
  const dragRef = useRef({ active: false, startMx: 0, startMy: 0, startPx: 0, startPy: 0, moved: false });
  const isDark = theme === "dark";
  const fg = isDark ? "#fff" : "#1a1a1a";
  const bgColor = isDark ? "#0a0a0a" : "#f5f5f5";

  const buildLayout = useCallback((W: number, H: number) => {
    const cx = W / 2, cy = H / 2;
    const sR = Math.min(W, H) * 0.28;
    const nodes: GNode[] = [];
    const edges: [number, number][] = [];

    // Only root-level folders (no parent)
    const rootFolders = folders.filter(f => !f.parent);

    // Group notes by folder
    const folderMap = new Map<string, Note[]>();
    notes.forEach(n => {
      const f = n.folder_name || "General";
      if (!folderMap.has(f)) folderMap.set(f, []);
      folderMap.get(f)!.push(n);
    });

    // Center node
    nodes.push({ id: "__root__", baseX: cx, baseY: cy, r: 22, color: fg, label: "STICKIES", type: "center", initial: "S",
      phX: 0, phY: 1.2, spX: 0.28, spY: 0.22, amp: 4 });

    // Root folder nodes only
    rootFolders.forEach((folder, fi) => {
      const fname = folder.name;
      const angle = (fi / rootFolders.length) * Math.PI * 2 - Math.PI / 2;
      const fx = cx + Math.cos(angle) * sR;
      const fy = cy + Math.sin(angle) * sR;
      const fc = folder.color || "#888";
      const count = folderMap.get(fname)?.length || 0;
      const sIdx = nodes.length;
      nodes.push({ id: `folder:${fname}`, baseX: fx, baseY: fy, r: 14 + Math.min(count, 15) * 0.3, color: fc,
        label: fname, type: "folder", folderName: fname, initial: fname.charAt(0).toUpperCase(),
        phX: Math.random() * 6.28, phY: Math.random() * 6.28,
        spX: 0.32 + Math.random() * 0.12, spY: 0.26 + Math.random() * 0.12, amp: 8 });
      edges.push([0, sIdx]);

      // Note nodes — max 7 per folder to keep clean
      const fnotes = (folderMap.get(fname) || []).slice(0, 7);
      const rR = sR * 0.38;
      fnotes.forEach((n, ri) => {
        const spread = Math.PI * 0.6;
        const rAngle = angle - spread / 2 + (ri / Math.max(fnotes.length - 1, 1)) * spread;
        const rIdx = nodes.length;
        nodes.push({ id: n.id, baseX: fx + Math.cos(rAngle) * rR, baseY: fy + Math.sin(rAngle) * rR,
          r: 3.5, color: fc, label: (n.title || "Untitled").slice(0, 20), type: "note", folderName: fname,
          initial: (n.title || "N").charAt(0).toUpperCase(),
          phX: Math.random() * 6.28, phY: Math.random() * 6.28,
          spX: 0.48 + Math.random() * 0.28, spY: 0.42 + Math.random() * 0.22, amp: 6 });
        edges.push([sIdx, rIdx]);
      });
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    posRef.current = nodes.map(n => ({ x: n.baseX, y: n.baseY }));
    panRef.current = { x: 0, y: 0 };
    targetPanRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    targetScaleRef.current = 1;
  }, [notes, folders, fg]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      buildLayout(W, H);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (!nodes.length) { rafRef.current = requestAnimationFrame(draw); return; }

      const lf = 0.13;
      panRef.current.x += (targetPanRef.current.x - panRef.current.x) * lf;
      panRef.current.y += (targetPanRef.current.y - panRef.current.y) * lf;
      scaleRef.current += (targetScaleRef.current - scaleRef.current) * lf;

      const ctx = canvas.getContext("2d")!;
      const dpr = devicePixelRatio;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      tRef.current += 0.007;
      const t = tRef.current;

      // Update positions
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        posRef.current[i] = {
          x: n.baseX + Math.sin(t * n.spX + n.phX) * n.amp,
          y: n.baseY + Math.cos(t * n.spY + n.phY) * n.amp,
        };
      }

      // Edges
      for (const [si, ti] of edges) {
        const src = posRef.current[si], tgt = posRef.current[ti];
        const isNote = nodes[ti].type === "note";
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = isDark
          ? (isNote ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.18)")
          : (isNote ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.12)");
        ctx.lineWidth = isNote ? 0.6 : 1.1;
        ctx.stroke();
      }

      // Nodes
      const sc = scaleRef.current;
      const labelAlpha = Math.max(0, Math.min(1, (sc - 1.2) / 0.8));

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pos = posRef.current[i];
        const pulse = 1 + Math.sin(t * 1.6 + n.phX) * 0.06;
        const r = n.r * pulse;

        // Glow
        const glowR = r * (n.type === "center" ? 5 : n.type === "folder" ? 4 : 3);
        const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
        grd.addColorStop(0, n.color + (n.type === "note" ? "30" : "44"));
        grd.addColorStop(0.45, n.color + "12");
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // All circles — size differs by layer
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.type === "note" ? n.color + "cc" : n.color;
        ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";

        if (n.type === "center") {
          ctx.font = "700 9px -apple-system, sans-serif";
          ctx.fillStyle = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
          ctx.shadowBlur = 0;
          ctx.fillText(n.initial, pos.x, pos.y);
          ctx.textBaseline = "alphabetic";
          ctx.font = "700 11px -apple-system, sans-serif";
          ctx.fillStyle = fg;
          ctx.shadowBlur = 6;
          ctx.fillText(n.label, pos.x, pos.y + r + 13);
          ctx.shadowBlur = 0;
        } else if (n.type === "folder") {
          ctx.font = `700 ${Math.max(r * 0.8, 8)}px -apple-system, sans-serif`;
          ctx.fillStyle = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
          ctx.shadowBlur = 0;
          ctx.fillText(n.initial, pos.x, pos.y);
          ctx.textBaseline = "alphabetic";
          ctx.font = "700 10px -apple-system, sans-serif";
          ctx.fillStyle = fg;
          ctx.shadowBlur = 6;
          ctx.fillText(n.label, pos.x, pos.y + r + 13);
          ctx.shadowBlur = 0;
        } else {
          ctx.font = "700 4px -apple-system, sans-serif";
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)";
          ctx.shadowBlur = 2;
          ctx.fillText(n.initial, pos.x, pos.y);
          if (labelAlpha > 0) {
            ctx.textBaseline = "alphabetic";
            ctx.font = "600 7px -apple-system, sans-serif";
            ctx.fillStyle = isDark ? `rgba(255,255,255,${0.7 * labelAlpha})` : `rgba(0,0,0,${0.5 * labelAlpha})`;
            ctx.shadowBlur = 4;
            ctx.fillText(n.label, pos.x, pos.y + r + 9);
            ctx.shadowBlur = 0;
          }
        }
        ctx.textBaseline = "alphabetic";
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [buildLayout, isDark, fg]);

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - panRef.current.x) / scaleRef.current,
    y: (sy - panRef.current.y) / scaleRef.current,
  });

  const hitTest = (sx: number, sy: number) => {
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const pos = posRef.current[i];
      if (!pos) continue;
      if (Math.hypot(wx - pos.x, wy - pos.y) <= nodesRef.current[i].r * 1.8) return nodesRef.current[i];
    }
    return null;
  };

  return (
    <div className="relative overflow-hidden" style={{ background: bgColor, flex: "1 1 0%", minHeight: 300 }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
        onMouseDown={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          if (hit) return;
          dragRef.current = { active: true, startMx: e.clientX, startMy: e.clientY, startPx: targetPanRef.current.x, startPy: targetPanRef.current.y, moved: false };
          canvasRef.current!.style.cursor = "grabbing";
        }}
        onMouseMove={(e) => {
          const d = dragRef.current;
          if (d.active) {
            const dx = e.clientX - d.startMx, dy = e.clientY - d.startMy;
            if (Math.hypot(dx, dy) > 3) d.moved = true;
            const nx = d.startPx + dx, ny = d.startPy + dy;
            panRef.current.x = nx; panRef.current.y = ny;
            targetPanRef.current.x = nx; targetPanRef.current.y = ny;
            canvasRef.current!.style.cursor = "grabbing";
            return;
          }
          const rect = canvasRef.current!.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          canvasRef.current!.style.cursor = hit ? "pointer" : "grab";
          setTooltip(hit && hit.type === "note" ? { x: e.clientX, y: e.clientY, node: hit } : null);
        }}
        onMouseUp={(e) => {
          const d = dragRef.current;
          const wasDrag = d.active && d.moved;
          dragRef.current.active = false;
          dragRef.current.moved = false;
          if (wasDrag) return;
          const rect = canvasRef.current!.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          if (!hit) return;
          if (hit.type === "note") {
            const note = notes.find(n => n.id === hit.id);
            if (note) onOpenNote(note);
          } else if (hit.type === "folder") {
            onClickFolder?.(hit.folderName!);
          } else if (hit.type === "center") {
            targetScaleRef.current = 1;
            targetPanRef.current = { x: 0, y: 0 };
          }
        }}
        onMouseLeave={() => { dragRef.current.active = false; setTooltip(null); if (canvasRef.current) canvasRef.current.style.cursor = "grab"; }}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.92 : 1.09;
          const newScale = Math.min(Math.max(targetScaleRef.current * factor, 0.25), 5);
          const rect = canvasRef.current!.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          const wx = (mx - targetPanRef.current.x) / targetScaleRef.current;
          const wy = (my - targetPanRef.current.y) / targetScaleRef.current;
          targetScaleRef.current = newScale;
          targetPanRef.current.x = mx - wx * newScale;
          targetPanRef.current.y = my - wy * newScale;
        }}
      />
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 10,
          pointerEvents: "none", zIndex: 50,
          background: isDark ? "#18181b" : "#fff",
          border: `1px solid ${tooltip.node.color}55`,
          borderRadius: 8, padding: "5px 10px",
          fontSize: 11, fontWeight: 600, color: isDark ? "#e4e4e7" : "#1a1a1a",
          boxShadow: `0 4px 20px ${tooltip.node.color}30`,
          maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          <span style={{ color: tooltip.node.color, marginRight: 6 }}>→</span>
          {tooltip.node.label}
        </div>
      )}
    </div>
  );
}
