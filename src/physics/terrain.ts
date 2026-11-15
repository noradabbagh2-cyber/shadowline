import type { TerrainLike } from './types';

export interface TerrainMeta {
  site: string;
  name: string;
  width: number;
  height: number;
  resolution_m: number;
  elevation_min_m: number;
  elevation_max_m: number;
  source_url: string;
  source_citation: string;
  native_resolution_m: number;
  downsample_factor: number;
  [key: string]: unknown;
}

/** Gridded heightmap with bilinear interpolation. Cell (col,row) is centered at ((col+0.5)·res, (row+0.5)·res). */
export class Terrain implements TerrainLike {
  readonly cols: number;
  readonly rows: number;
  readonly resolutionM: number;
  readonly widthM: number;
  readonly heightM: number;

  constructor(
    readonly data: Float32Array,
    readonly meta: TerrainMeta,
  ) {
    this.cols = meta.width;
    this.rows = meta.height;
    this.resolutionM = meta.resolution_m;
    if (data.length !== this.cols * this.rows) {
      throw new Error(`Terrain size mismatch: ${data.length} values for ${this.cols}×${this.rows}`);
    }
    this.widthM = this.cols * this.resolutionM;
    this.heightM = this.rows * this.resolutionM;
  }

  elevationAt(x: number, y: number): number {
    const half = 0.5; // cell-center offset, in cells
    let fx = x / this.resolutionM - half;
    let fy = y / this.resolutionM - half;
    if (fx < 0) fx = 0;
    else if (fx > this.cols - 1) fx = this.cols - 1;
    if (fy < 0) fy = 0;
    else if (fy > this.rows - 1) fy = this.rows - 1;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = x0 + 1 < this.cols ? x0 + 1 : x0;
    const y1 = y0 + 1 < this.rows ? y0 + 1 : y0;
    const tx = fx - x0;
    const ty = fy - y0;
    const d = this.data;
    const top = d[y0 * this.cols + x0] * (1 - tx) + d[y0 * this.cols + x1] * tx;
    const bot = d[y1 * this.cols + x0] * (1 - tx) + d[y1 * this.cols + x1] * tx;
    return top * (1 - ty) + bot * ty;
  }
}

/** Perfectly flat ground. Used by the verification tests and as the published-model comparison case. */
export class FlatTerrain implements TerrainLike {
  constructor(
    readonly widthM: number,
    readonly heightM: number,
    readonly resolutionM: number,
    readonly elevationM = 0,
  ) {}
  elevationAt(): number {
    return this.elevationM;
  }
}
