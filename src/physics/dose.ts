/**
 * Shadowline dose engine — pure functions, no UI.
 *
 * Model (calibrated to published anchors; see constants.ts for sources):
 *   inside the shield cone :  D = 5  rem/yr × (1000 m / r)²
 *   outside the shield cone:  D = 50 rem/yr × (1000 m / r)²
 *   through x cm of regolith: D × e^(−k·x)
 *
 * Simplifications (listed in README "Known limitations"):
 *   - point source; r is horizontal map distance (≤ slant distance, so conservative)
 *   - the cone is evaluated in the horizontal plane (flat-ground wedge geometry)
 *   - no neutron scatter / skyshine: anything off the straight line of sight is ignored
 *   - uniform regolith with a single attenuation coefficient k
 */
import { V } from './constants';
import type { Berm, Reactor, TerrainLike, Vec2 } from './types';

const DEG_TO_RAD = Math.PI / 180;

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle in degrees between the shield axis (reactor → aim) and the direction reactor → point. */
export function offAxisAngleDeg(point: Vec2, reactor: Reactor): number {
  const ax = reactor.aim.x - reactor.pos.x;
  const ay = reactor.aim.y - reactor.pos.y;
  const px = point.x - reactor.pos.x;
  const py = point.y - reactor.pos.y;
  const la = Math.hypot(ax, ay);
  const lp = Math.hypot(px, py);
  if (la === 0 || lp === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (ax * px + ay * py) / (la * lp)));
  return Math.acos(cos) / DEG_TO_RAD;
}

/** True when `point` lies inside the shield shadow (within half the included angle of the axis). */
export function inShieldCone(point: Vec2, reactor: Reactor, shieldAngleDeg: number): boolean {
  const HALF = 0.5;
  // Tiny tolerance so a point placed exactly on the cone edge counts as inside.
  const EDGE_TOLERANCE_DEG = 1e-9;
  return offAxisAngleDeg(point, reactor) <= shieldAngleDeg * HALF + EDGE_TOLERANCE_DEG;
}

/** Dose rate (rem/yr) with nothing on the line of sight. */
export function unshieldedDoseRate(point: Vec2, reactor: Reactor, shieldAngleDeg: number): number {
  const r = Math.max(distance(point, reactor.pos), V.MIN_DISTANCE_M);
  const anchor = inShieldCone(point, reactor, shieldAngleDeg) ? V.DOSE_IN_CONE_REM_YR : V.DOSE_OUT_CONE_REM_YR;
  return anchor * (V.REFERENCE_DISTANCE_M / r) ** 2;
}

/**
 * Meters of terrain crossed by the straight line from the reactor core to a
 * receptor standing at `point`. Marches the 3-D segment at half-cell steps and
 * sums the length of every step whose midpoint is below ground.
 */
export function terrainPathLengthM(point: Vec2, source: Vec2, terrain: TerrainLike): number {
  const dx = point.x - source.x;
  const dy = point.y - source.y;
  const horiz = Math.hypot(dx, dy);
  if (horiz === 0) return 0;
  const z0 = terrain.elevationAt(source.x, source.y) + V.SOURCE_HEIGHT_M;
  const z1 = terrain.elevationAt(point.x, point.y) + V.RECEPTOR_HEIGHT_M;
  const HALF = 0.5;
  const n = Math.max(2, Math.ceil(horiz / (terrain.resolutionM * HALF)));
  const stepLen = Math.hypot(horiz, z1 - z0) / n;
  let buried = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + HALF) / n;
    const ground = terrain.elevationAt(source.x + dx * t, source.y + dy * t);
    if (z0 + (z1 - z0) * t < ground) buried += stepLen;
  }
  return buried;
}

/**
 * Meters of berm crossed by the line of sight. A berm counts only if the
 * sight line crosses its footprint below the berm top. Oblique crossings see
 * a longer path (thickness / sin of the crossing angle), capped at berm length.
 */
export function bermPathLengthM(point: Vec2, source: Vec2, terrain: TerrainLike, berms: readonly Berm[]): number {
  if (berms.length === 0) return 0;
  const rx = point.x - source.x;
  const ry = point.y - source.y;
  let total = 0;
  for (const berm of berms) {
    const sx = berm.b.x - berm.a.x;
    const sy = berm.b.y - berm.a.y;
    const denom = rx * sy - ry * sx;
    if (denom === 0) continue; // parallel
    const qx = berm.a.x - source.x;
    const qy = berm.a.y - source.y;
    const t = (qx * sy - qy * sx) / denom; // along the sight line
    const u = (qx * ry - qy * rx) / denom; // along the berm
    if (t <= 0 || t >= 1 || u < 0 || u > 1) continue;
    const cx = source.x + rx * t;
    const cy = source.y + ry * t;
    const z0 = terrain.elevationAt(source.x, source.y) + V.SOURCE_HEIGHT_M;
    const z1 = terrain.elevationAt(point.x, point.y) + V.RECEPTOR_HEIGHT_M;
    const rayZ = z0 + (z1 - z0) * t;
    const bermTop = terrain.elevationAt(cx, cy) + berm.heightM;
    if (rayZ > bermTop) continue; // sight line clears the berm
    const bermLen = Math.hypot(sx, sy);
    const sinCross = Math.abs(denom) / (Math.hypot(rx, ry) * bermLen);
    total += Math.min(berm.thicknessM / sinCross, bermLen);
  }
  return total;
}

/**
 * Attenuation factor e^(−k·x) for everything on the line of sight.
 * @param k regolith attenuation coefficient, 1/cm
 */
export function lineOfSightAttenuation(
  point: Vec2,
  source: Vec2,
  terrain: TerrainLike,
  k: number,
  berms: readonly Berm[] = [],
): number {
  const meters = terrainPathLengthM(point, source, terrain) + bermPathLengthM(point, source, terrain, berms);
  return attenuation(meters * V.CM_PER_M, k);
}

/** e^(−k·x) for x cm of regolith. */
export function attenuation(thicknessCm: number, k: number): number {
  return Math.exp(-k * thicknessCm);
}

/**
 * Reactor dose rate (rem/yr, above background, continuous outdoor occupancy)
 * for a person standing at `point`.
 */
export function doseRate(
  point: Vec2,
  reactor: Reactor,
  shieldAngleDeg: number,
  terrain: TerrainLike,
  k: number,
  berms: readonly Berm[] = [],
): number {
  return (
    unshieldedDoseRate(point, reactor, shieldAngleDeg) * lineOfSightAttenuation(point, reactor.pos, terrain, k, berms)
  );
}

/**
 * Inverse-square standoff: the distance at which a source that gives
 * `doseAtRef` at `refDistanceM` falls to `targetDose` (same units).
 */
export function standoffDistanceM(doseAtRef: number, refDistanceM: number, targetDose: number): number {
  return refDistanceM * Math.sqrt(doseAtRef / targetDose);
}

export function remToMsv(rem: number): number {
  return rem * V.REM_TO_MSV;
}
