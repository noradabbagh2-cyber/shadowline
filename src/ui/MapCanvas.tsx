import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { V } from '../physics/constants';
import { distance, doseRate, inShieldCone, remToMsv, terrainPathLengthM, bermPathLengthM } from '../physics/dose';
import type { DoseField } from '../physics/field';
import type { Terrain } from '../physics/terrain';
import type { Vec2 } from '../physics/types';
import type { Layout, Level, Settings } from '../game/types';
import { sampleRoute } from '../physics/exposure';
import { contourSegments, renderHeatmap, renderHillshade } from './heatmap';
import { fmtDist, fmtMsv } from './format';

export type Tool = 'move' | 'waypoint' | 'berm';

interface Props {
  terrain: Terrain;
  layout: Layout;
  level: Level;
  settings: Settings;
  field: DoseField;
  tool: Tool;
  showHeatmap: boolean;
  onLayout: (l: Layout) => void;
  onDragging: (d: boolean) => void;
  onToolDone: () => void;
}

interface View {
  cx: number;
  cy: number;
  /** pixels per meter */
  scale: number;
}

type DragTarget =
  | { kind: 'reactor' }
  | { kind: 'habitat' }
  | { kind: 'waypoint'; index: number }
  | { kind: 'pan'; startX: number; startY: number; view: View }
  | { kind: 'berm'; a: Vec2 };

const HIT_PX = 16;
const MIN_BERM_M = 5;
const COL = {
  reactor: '#f5b942',
  crew: '#6fdcf0',
  site: '#c9a2ff',
  berm: '#d9935a',
  contour: '#ffffff',
  cone: 'rgba(111, 220, 240, 0.9)',
  ink: '#eef2f8',
};

export function MapCanvas(props: Props) {
  const { terrain, layout, level, settings, field, tool, showHeatmap, onLayout, onDragging, onToolDone } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>(() => ({
    cx: (layout.reactor.x + layout.habitat.x + level.scienceSite.x) / 3,
    cy: (layout.reactor.y + layout.habitat.y + level.scienceSite.y) / 3,
    scale: 0.14,
  }));
  const dragRef = useRef<DragTarget | null>(null);
  const [draftBerm, setDraftBerm] = useState<{ a: Vec2; b: Vec2 } | null>(null);
  const [hover, setHover] = useState<Vec2 | null>(null);

  const msvPerRemYr = remToMsv(1) * (level.missionDays / V.DAYS_PER_YEAR);
  const limit = V.CREW_LIMIT_NUCLEAR_MSV;

  const hillshade = useMemo(() => renderHillshade(terrain), [terrain]);
  const heat = useMemo(() => renderHeatmap(field, msvPerRemYr, limit), [field, msvPerRemYr, limit]);
  const contour = useMemo(() => contourSegments(field, limit / msvPerRemYr), [field, limit, msvPerRemYr]);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const toScreen = useCallback(
    (p: Vec2) => ({ x: (p.x - view.cx) * view.scale + size.w / 2, y: (p.y - view.cy) * view.scale + size.h / 2 }),
    [view, size],
  );
  const toMap = useCallback(
    (sx: number, sy: number): Vec2 => ({
      x: (sx - size.w / 2) / view.scale + view.cx,
      y: (sy - size.h / 2) / view.scale + view.cy,
    }),
    [view, size],
  );
  const clampToMap = useCallback(
    (p: Vec2): Vec2 => ({
      x: Math.min(Math.max(p.x, 0), terrain.widthM),
      y: Math.min(Math.max(p.y, 0), terrain.heightM),
    }),
    [terrain],
  );

  /** For each berm: does it block the line of sight to the habitat or any part of the EVA route? */
  const bermBlocks = useMemo(() => {
    const targets = sampleRoute([layout.habitat, ...layout.waypoints, level.scienceSite], V.EVA_SAMPLE_SPACING_M);
    return layout.berms.map((b) => targets.some((p) => bermPathLengthM(p, layout.reactor, terrain, [b]) > 0));
  }, [layout, level, terrain]);
  const idleBerms = bermBlocks.filter((b) => !b).length;

  // ------------------------------------------------------------------ draw
  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, size.w, size.h);

    const o = toScreen({ x: 0, y: 0 });
    const wPx = terrain.widthM * view.scale;
    const hPx = terrain.heightM * view.scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hillshade, o.x, o.y, wPx, hPx);
    if (showHeatmap) ctx.drawImage(heat, o.x, o.y, wPx, hPx);

    const R = toScreen(layout.reactor);
    const H = toScreen(layout.habitat);
    const S = toScreen(level.scienceSite);

    // shield shadow wedge
    const axis = Math.atan2(layout.habitat.y - layout.reactor.y, layout.habitat.x - layout.reactor.x);
    const half = ((V.SHIELD_CONE_ANGLE_DEG / 2) * Math.PI) / 180;
    const reach = (terrain.widthM + terrain.heightM) * view.scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, o.y, wPx, hPx);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(R.x, R.y);
    ctx.arc(R.x, R.y, reach, axis - half, axis + half);
    ctx.closePath();
    ctx.fillStyle = 'rgba(111, 220, 240, 0.07)';
    ctx.fill();
    ctx.strokeStyle = COL.cone;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 6]);
    for (const a of [axis - half, axis + half]) {
      ctx.beginPath();
      ctx.moveTo(R.x, R.y);
      ctx.lineTo(R.x + Math.cos(a) * reach, R.y + Math.sin(a) * reach);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 1 km reference ring
    ctx.strokeStyle = 'rgba(245, 185, 66, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(R.x, R.y, V.REFERENCE_DISTANCE_M * view.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '1 km', R.x, R.y - V.REFERENCE_DISTANCE_M * view.scale - 6, 'rgba(245, 185, 66, 0.9)', 11);

    // limit contour
    if (showHeatmap) {
      ctx.strokeStyle = COL.contour;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < contour.length; i += 4) {
        ctx.moveTo(o.x + contour[i] * view.scale, o.y + contour[i + 1] * view.scale);
        ctx.lineTo(o.x + contour[i + 2] * view.scale, o.y + contour[i + 3] * view.scale);
      }
      ctx.stroke();
    }
    ctx.restore();

    // cable
    ctx.strokeStyle = COL.reactor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R.x, R.y);
    ctx.lineTo(H.x, H.y);
    ctx.stroke();

    // EVA route
    ctx.strokeStyle = COL.crew;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([3, 6]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(H.x, H.y);
    for (const w of layout.waypoints) {
      const p = toScreen(w);
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(S.x, S.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';

    // berms
    const berms = draftBerm ? [...layout.berms, { ...draftBerm }] : layout.berms;
    berms.forEach((b, bi) => {
      const a = toScreen(b.a);
      const c = toScreen(b.b);
      ctx.strokeStyle = '#1a0f06';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      const idle = bi < bermBlocks.length && !bermBlocks[bi];
      ctx.strokeStyle = idle ? '#7d6a5b' : COL.berm;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (idle) label(ctx, 'not blocking', (a.x + c.x) / 2, (a.y + c.y) / 2 - 10, '#d8c7b8', 11);
    });

    // markers
    layout.waypoints.forEach((w, i) => {
      const p = toScreen(w);
      disc(ctx, p.x, p.y, 7, '#0b1218', COL.crew);
      label(ctx, `${i + 1}`, p.x, p.y + 3.5, COL.crew, 10);
    });
    siteMarker(ctx, S.x, S.y);
    label(ctx, 'Science site', S.x, S.y + 26, COL.site, 12);
    habitatMarker(ctx, H.x, H.y);
    label(ctx, 'Habitat', H.x, H.y + 28, COL.crew, 12);
    reactorMarker(ctx, R.x, R.y);
    label(ctx, 'Reactor', R.x, R.y + 30, COL.reactor, 12);

    // scale bar
    const barM = niceScale(120 / view.scale);
    const bx = 18;
    const by = size.h - 22;
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by - 5);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + barM * view.scale, by);
    ctx.lineTo(bx + barM * view.scale, by - 5);
    ctx.stroke();
    label(ctx, fmtDist(barM), bx + (barM * view.scale) / 2, by - 8, COL.ink, 11);
  }, [size, view, layout, level, terrain, hillshade, heat, contour, showHeatmap, draftBerm, toScreen, bermBlocks]);

  // ----------------------------------------------------------- interaction
  const eventPos = (e: React.PointerEvent | React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const hit = (sx: number, sy: number): DragTarget | null => {
    const near = (p: Vec2) => {
      const s = toScreen(p);
      return Math.hypot(s.x - sx, s.y - sy) <= HIT_PX;
    };
    if (near(layout.reactor)) return { kind: 'reactor' };
    if (near(layout.habitat)) return { kind: 'habitat' };
    const wi = layout.waypoints.findIndex(near);
    if (wi >= 0) return { kind: 'waypoint', index: wi };
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { sx, sy } = eventPos(e);
    const m = clampToMap(toMap(sx, sy));
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === 'waypoint') {
      onLayout({ ...layout, waypoints: [...layout.waypoints, m] });
      onToolDone();
      return;
    }
    if (tool === 'berm') {
      dragRef.current = { kind: 'berm', a: m };
      setDraftBerm({ a: m, b: m });
      return;
    }
    const target = hit(sx, sy);
    if (target) {
      dragRef.current = target;
      onDragging(true);
    } else {
      dragRef.current = { kind: 'pan', startX: sx, startY: sy, view };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { sx, sy } = eventPos(e);
    const d = dragRef.current;
    const m = clampToMap(toMap(sx, sy));
    if (!d) {
      setHover(m);
      return;
    }
    switch (d.kind) {
      case 'reactor':
        onLayout({ ...layout, reactor: m });
        break;
      case 'habitat':
        onLayout({ ...layout, habitat: m });
        break;
      case 'waypoint':
        onLayout({ ...layout, waypoints: layout.waypoints.map((w, i) => (i === d.index ? m : w)) });
        break;
      case 'pan':
        setView({
          ...d.view,
          cx: d.view.cx - (sx - d.startX) / d.view.scale,
          cy: d.view.cy - (sy - d.startY) / d.view.scale,
        });
        break;
      case 'berm':
        setDraftBerm({ a: d.a, b: m });
        break;
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'berm') {
      if (draftBerm && distance(draftBerm.a, draftBerm.b) >= MIN_BERM_M) {
        onLayout({
          ...layout,
          berms: [...layout.berms, { ...draftBerm, heightM: V.BERM_HEIGHT_M, thicknessM: settings.bermThicknessM }],
        });
      }
      setDraftBerm(null);
      onToolDone();
    } else if (d.kind !== 'pan') {
      onDragging(false);
    }
  };

  const zoomBy = (factor: number, sx = size.w / 2, sy = size.h / 2) => {
    const minScale = Math.min(size.w / terrain.widthM, size.h / terrain.heightM) * 0.8;
    // functional update so several wheel events between renders all count
    setView((v) => {
      const mx = (sx - size.w / 2) / v.scale + v.cx;
      const my = (sy - size.h / 2) / v.scale + v.cy;
      const scale = Math.min(Math.max(v.scale * factor, minScale), 4);
      return { scale, cx: mx - (sx - size.w / 2) / scale, cy: my - (sy - size.h / 2) / scale };
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    const { sx, sy } = eventPos(e);
    zoomBy(Math.exp(-e.deltaY * 0.0015), sx, sy);
  };

  // --------------------------------------------------------- hover readout
  const hoverInfo = useMemo(() => {
    if (!hover) return null;
    const reactor = { pos: layout.reactor, aim: layout.habitat };
    const rate = doseRate(hover, reactor, V.SHIELD_CONE_ANGLE_DEG, terrain, settings.k, layout.berms);
    const blocked =
      terrainPathLengthM(hover, layout.reactor, terrain) > 0
        ? 'behind terrain'
        : bermPathLengthM(hover, layout.reactor, terrain, layout.berms) > 0
          ? 'behind a berm'
          : inShieldCone(hover, reactor, V.SHIELD_CONE_ANGLE_DEG)
            ? 'in shield shadow'
            : 'outside shield shadow';
    return {
      dist: distance(hover, layout.reactor),
      elev: terrain.elevationAt(hover.x, hover.y),
      mission: rate * msvPerRemYr,
      blocked,
    };
  }, [hover, layout, terrain, settings.k, msvPerRemYr]);

  const cursor = tool === 'move' ? 'grab' : 'crosshair';

  return (
    <div className="map" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        aria-label="Top-down terrain map with reactor, habitat, shield shadow and dose heatmap"
      />
      <div className="map-zoom">
        <button onClick={() => zoomBy(1.4)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">−</button>
      </div>
      {tool !== 'move' && (
        <div className="map-hint">
          {tool === 'waypoint'
            ? 'Click the map to add an EVA waypoint.'
            : `Press and drag to draw a ${V.BERM_HEIGHT_M} m tall regolith berm. It only helps if the sight line from the reactor to the crew passes below its top, so build close to the reactor.`}
        </div>
      )}
      {tool === 'move' && idleBerms > 0 && (
        <div className="map-hint warn">
          {idleBerms === 1 ? 'A berm is' : `${idleBerms} berms are`} not blocking: the crew&apos;s line of sight to the
          reactor passes over the top. Try building closer to the reactor.
        </div>
      )}
      <div className="map-readout" data-testid="hover-readout">
        {hoverInfo ? (
          <>
            <b>{fmtDist(hoverInfo.dist)}</b> from reactor · elevation {Math.round(hoverInfo.elev)} m · {hoverInfo.blocked}
            <br />
            Standing here outdoors for all {level.missionDays} days: <b>{fmtMsv(hoverInfo.mission)} mSv</b> from the
            reactor
          </>
        ) : (
          <>Drag the reactor or habitat. Drag empty ground to pan, scroll to zoom.</>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ draw helpers
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, px: number) {
  ctx.font = `600 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5, 7, 11, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function reactorMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  disc(ctx, x, y, 13, '#1b1405', COL.reactor);
  ctx.fillStyle = COL.reactor;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 9, a - 0.5, a + 0.5);
    ctx.closePath();
    ctx.fill();
  }
  disc(ctx, x, y, 2.5, '#1b1405', '#1b1405');
}

function habitatMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  disc(ctx, x, y, 13, '#06171c', COL.crew);
  ctx.fillStyle = COL.crew;
  ctx.beginPath();
  ctx.arc(x, y + 4, 7.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

function siteMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 11, y);
  ctx.lineTo(x, y + 12);
  ctx.lineTo(x - 11, y);
  ctx.closePath();
  ctx.fillStyle = '#150d22';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COL.site;
  ctx.stroke();
  disc(ctx, x, y, 3, COL.site, COL.site);
}

function niceScale(m: number): number {
  const pow = 10 ** Math.floor(Math.log10(m));
  const f = m / pow;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * pow;
}
