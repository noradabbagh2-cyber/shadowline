import { doseRate } from './dose';
import type { Berm, Reactor, TerrainLike } from './types';

/** Dose-rate grid (rem/yr, continuous outdoor occupancy) covering the whole terrain tile. */
export interface DoseField {
  n: number;
  cellM: number;
  data: Float32Array;
}

export function computeDoseField(
  terrain: TerrainLike,
  reactor: Reactor,
  shieldAngleDeg: number,
  k: number,
  berms: readonly Berm[],
  n: number,
): DoseField {
  const HALF = 0.5;
  const cellM = terrain.widthM / n;
  const data = new Float32Array(n * n);
  const p = { x: 0, y: 0 };
  for (let j = 0; j < n; j++) {
    p.y = (j + HALF) * cellM;
    for (let i = 0; i < n; i++) {
      p.x = (i + HALF) * cellM;
      data[j * n + i] = doseRate(p, reactor, shieldAngleDeg, terrain, k, berms);
    }
  }
  return { n, cellM, data };
}
