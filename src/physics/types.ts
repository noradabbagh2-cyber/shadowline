/** Map coordinates in meters. x increases to the right, y increases downward (row order of the terrain grid). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Reactor: a point source whose shadow shield axis points at `aim` (the habitat). */
export interface Reactor {
  pos: Vec2;
  aim: Vec2;
}

/** A straight regolith wall built by the player. */
export interface Berm {
  a: Vec2;
  b: Vec2;
  heightM: number;
  thicknessM: number;
}

/** Anything that can report ground elevation (meters) at a map position. */
export interface TerrainLike {
  readonly widthM: number;
  readonly heightM: number;
  readonly resolutionM: number;
  elevationAt(x: number, y: number): number;
}
