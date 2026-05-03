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
  iconKey?: string;
  phX: number; phY: number;
  spX: number; spY: number;
  amp: number;
}

// Render heroicon SVG paths as canvas-drawable images
const iconCache = new Map<string, HTMLImageElement>();
function getIconImage(iconName: string, color: string): HTMLImageElement | null {
  const key = `${iconName}:${color}`;
  if (iconCache.has(key)) { const c = iconCache.get(key)!; return c.complete ? c : null; }
  const paths: Record<string, string> = {
    CalendarDaysIcon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
    LightBulbIcon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
    CheckIcon: "M4.5 12.75l6 6 9-13.5",
    ClipboardDocumentListIcon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25",
    BoltIcon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75",
    DevicePhoneMobileIcon: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
    TrophyIcon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172",
    PresentationChartBarIcon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5",
    BriefcaseIcon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0",
    HomeIcon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
    RobotIcon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
    ShareIcon: "M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z",
    CheckCircleIcon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };
  const heroName = iconName.replace("__hero:", "");
  const d = paths[heroName];
  if (!d) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const img = new Image();
  img.src = "data:image/svg+xml," + encodeURIComponent(svg);
  iconCache.set(key, img);
  return img.complete ? img : null;
}

export function GraphView({ notes, folders, folderIcons = {}, onOpenNote, onClickFolder, theme }: GraphViewProps) {
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
  const claudeImgRef = useRef<HTMLImageElement | null>(null);

  // Load Claude icon
  useEffect(() => {
    const img = new Image();
    img.src = "/claude-icon.png";
    img.onload = () => { claudeImgRef.current = img; };
  }, []);

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
        label: fname, type: "folder", folderName: fname, initial: fname.charAt(0).toUpperCase(), iconKey: folderIcons[fname] || "",
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

        // Circle — CLAUDE gets white bg + border
        const isClaude = n.folderName === "CLAUDE" || n.label === "CLAUDE";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isClaude ? "#fff" : (n.type === "note" ? n.color + "cc" : n.color);
        ctx.fill();
        ctx.strokeStyle = isClaude ? "rgba(0,0,0,0.15)" : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)");
        ctx.lineWidth = 1;
        ctx.stroke();

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
          // Folder icon inside circle
          if (isClaude && claudeImgRef.current) {
            const imgSize = r * 1.4;
            ctx.drawImage(claudeImgRef.current, pos.x - imgSize / 2, pos.y - imgSize / 2, imgSize, imgSize);
          } else if (n.iconKey) {
            const iconColor = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
            const iconImg = getIconImage(n.iconKey, iconColor);
            if (iconImg) {
              const imgSize = r * 1.3;
              ctx.drawImage(iconImg, pos.x - imgSize / 2, pos.y - imgSize / 2, imgSize, imgSize);
            } else {
              ctx.font = `700 ${Math.max(r * 0.8, 8)}px -apple-system, sans-serif`;
              ctx.fillStyle = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
              ctx.shadowBlur = 0;
              ctx.fillText(n.initial, pos.x, pos.y);
            }
          } else {
            ctx.font = `700 ${Math.max(r * 0.8, 8)}px -apple-system, sans-serif`;
            ctx.fillStyle = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
            ctx.shadowBlur = 0;
            ctx.fillText(n.initial, pos.x, pos.y);
          }
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
