import { V } from './constants';
import type { Berm } from './types';

/**
 * Power cable mass (kg) for a straight-line run of `distanceM`.
 * ASSUMPTION: 73 kg/km (NASA Glenn 40 kWe concept, ±2800 VDC) scaled linearly with distance.
 */
export function cableMass(distanceM: number): number {
  return (distanceM / V.M_PER_KM) * V.CABLE_MASS_KG_PER_KM;
}

/** Regolith mass (tonnes) in a set of rectangular berms: length × height × thickness × bulk density. */
export function regolithMovedTonnes(berms: readonly Berm[]): number {
  // 1 g/cm³ = 1 t/m³, so density in g/cm³ is numerically tonnes per cubic meter.
  return berms.reduce(
    (sum, b) => sum + Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) * b.heightM * b.thicknessM * V.REGOLITH_DENSITY_G_CM3,
    0,
  );
}
