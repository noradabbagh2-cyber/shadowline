/**
 * Heatmap rendering helpers. The plotted quantity is "mission dose if a crew
 * member stood here, outdoors, for the whole mission" in mSv, compared with the limit.
 */
import type { DoseField } from '../physics/field';
import type { Terrain } from '../physics/terrain';

/** Colour scale spans this many decades either side of the limit. */
export const DECADES = 2;

type RGBA = [number, number, number, number];
const BELOW: RGBA[] = [
  [40, 110, 200, 0],
  [60, 170, 215, 110],
  [120, 215, 200, 135],
];
const ABOVE: RGBA[] = [
  [250, 215, 80, 150],
  [245, 140, 50, 165],
  [225, 60, 60, 180],
  [170, 40, 140, 190],
];

function ramp(stops: RGBA[], t: number): RGBA {
  const f = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(f), stops.length - 2);
  const u = f - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}

/** ratio = mission dose ÷ limit. */
export function doseColor(ratio: number): RGBA {
  if (!(ratio > 0)) return [0, 0, 0, 0];
  const t = Math.log10(ratio);
  return t < 0 ? ramp(BELOW, (t + DECADES) / DECADES) : ramp(ABOVE, t / DECADES);
}

export function renderHeatmap(field: DoseField, msvPerRemYr: number, limitMsv: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = field.n;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(field.n, field.n);
  for (let i = 0; i < field.data.length; i++) {
    const [r, g, b, a] = doseColor((field.data[i] * msvPerRemYr) / limitMsv);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Marching-squares iso-line of the field at `level` (same units as the field). Returns map-space segments. */
export function contourSegments(field: DoseField, level: number): Float32Array {
  const { n, cellM, data } = field;
  const out: number[] = [];
  const lerp = (a: number, b: number) => {
    // A masked cell (terrain or berm) is many orders of magnitude lower: split the edge evenly.
    if (Math.min(a, b) < level * 1e-3) return 0.5;
    // otherwise interpolate in log space: the field falls off as 1/r²
    const la = Math.log(Math.max(a, 1e-30));
    const lb = Math.log(Math.max(b, 1e-30));
    const t = (Math.log(level) - la) / (lb - la);
    return Math.min(Math.max(t, 0), 1);
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const v0 = data[j * n + i];
      const v1 = data[j * n + i + 1];
      const v2 = data[(j + 1) * n + i + 1];
      const v3 = data[(j + 1) * n + i];
      const code = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const x = (i + 0.5) * cellM;
      const y = (j + 0.5) * cellM;
      const top: [number, number] = [x + lerp(v0, v1) * cellM, y];
      const right: [number, number] = [x + cellM, y + lerp(v1, v2) * cellM];
      const bottom: [number, number] = [x + lerp(v3, v2) * cellM, y + cellM];
      const left: [number, number] = [x, y + lerp(v0, v3) * cellM];
      const seg = (a: [number, number], b: [number, number]) => out.push(a[0], a[1], b[0], b[1]);
      switch (code) {
        case 1: case 14: seg(left, top); break;
        case 2: case 13: seg(top, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(right, bottom); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, bottom); break;
        case 5: seg(left, top); seg(right, bottom); break;
        case 10: seg(top, right); seg(left, bottom); break;
      }
    }
  }
  return new Float32Array(out);
}

/** Shaded-relief image of the heightmap (light from the upper left, low sun). */
export function renderHillshade(terrain: Terrain): HTMLCanvasElement {
  const { cols, rows, data, resolutionM } = terrain;
  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(cols, rows);
  const lo = terrain.meta.elevation_min_m;
  const span = terrain.meta.elevation_max_m - lo || 1;
  // light direction (unit vector), from upper-left, 35° above the horizon
  const lx = -0.58, ly = -0.58, lz = 0.57;
  const exaggeration = 1.6;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const xl = data[y * cols + Math.max(x - 1, 0)];
      const xr = data[y * cols + Math.min(x + 1, cols - 1)];
      const yu = data[Math.max(y - 1, 0) * cols + x];
      const yd = data[Math.min(y + 1, rows - 1) * cols + x];
      const gx = ((xr - xl) / (2 * resolutionM)) * exaggeration;
      const gy = ((yd - yu) / (2 * resolutionM)) * exaggeration;
      const inv = 1 / Math.hypot(gx, gy, 1);
      const shade = Math.max(0, (-gx * lx - gy * ly + lz) * inv);
      const elev = (data[y * cols + x] - lo) / span;
      const v = 28 + 150 * shade * (0.55 + 0.45 * elev) + 22 * elev;
      const o = (y * cols + x) * 4;
      img.data[o] = v * 0.96;
      img.data[o + 1] = v * 0.98;
      img.data[o + 2] = v * 1.06;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
