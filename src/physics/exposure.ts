/**
 * Exposure model: mission dose = Σ (dose rate at a location × time spent there).
 * Reactor dose and natural background are computed and reported separately.
 */
import { V } from './constants';
import { distance, doseRate, inShieldCone, remToMsv } from './dose';
import type { Berm, Reactor, TerrainLike, Vec2 } from './types';

/** One entry of a crew schedule. */
export interface ScheduleEntry {
  label: string;
  /** Outdoor reactor dose rate at this location, rem/yr. */
  doseRateRemYr: number;
  hoursPerDay: number;
  /** Multiplier for local shielding (1 = outdoors, habitat factor indoors). */
  shieldFactor: number;
}

export interface Schedule {
  missionDays: number;
  entries: ScheduleEntry[];
}

/** Reactor dose over the mission, in mSv, per entry and in total. */
export function annualDose(schedule: Schedule): { totalMsv: number; byEntryMsv: number[] } {
  const hoursPerYear = V.DAYS_PER_YEAR * V.HOURS_PER_DAY;
  const byEntryMsv = schedule.entries.map(
    (e) => remToMsv(e.doseRateRemYr) * e.shieldFactor * ((e.hoursPerDay * schedule.missionDays) / hoursPerYear),
  );
  return { totalMsv: byEntryMsv.reduce((a, b) => a + b, 0), byEntryMsv };
}

/** Natural background over the mission (mSv), unshielded surface value. */
export function backgroundDoseMsv(missionDays: number): number {
  return (V.BACKGROUND_USV_DAY * missionDays) / V.USV_PER_MSV;
}

/** Evenly spaced sample points along a polyline (always includes both ends). */
export function sampleRoute(route: readonly Vec2[], spacingM: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    const n = Math.max(1, Math.ceil(distance(a, b) / spacingM));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  if (route.length > 0) out.push(route[route.length - 1]);
  return out;
}

export interface ExposureInputs {
  reactor: Reactor;
  habitat: Vec2;
  /** EVA route, starting at the habitat airlock. Time is spread evenly along it. */
  evaRoute: readonly Vec2[];
  berms: readonly Berm[];
  terrain: TerrainLike;
  k: number;
  shieldAngleDeg: number;
  missionDays: number;
  habitatHoursPerDay: number;
  habitatShieldFactor: number;
}

export interface ExposureResult {
  /** Reactor dose over the mission, mSv. */
  reactorMsv: number;
  habitatMsv: number;
  evaMsv: number;
  /** EVA dose received on the parts of the route inside / outside the shield cone. */
  evaInConeMsv: number;
  evaOutConeMsv: number;
  /** Fraction of the EVA route (by length) outside the shield cone. */
  evaFractionOutsideCone: number;
  /** Fraction of the EVA route with regolith (terrain or berm) on the line of sight. */
  evaFractionMasked: number;
  habitatOutdoorRateRemYr: number;
  habitatInCone: boolean;
  habitatMasked: boolean;
  evaHoursPerDay: number;
  backgroundMsv: number;
  routeLengthM: number;
}

/** Any attenuation below this counts as "masked" for the plain-language explanation. */
const MASKED_BELOW = 0.5;

export function computeExposure(inp: ExposureInputs): ExposureResult {
  const { reactor, habitat, terrain, k, berms, shieldAngleDeg } = inp;
  const evaHours = V.HOURS_PER_DAY - inp.habitatHoursPerDay;

  const habRate = doseRate(habitat, reactor, shieldAngleDeg, terrain, k, berms);
  const habUnshielded = doseRate(habitat, reactor, shieldAngleDeg, flat(terrain), k);
  const samples = sampleRoute(inp.evaRoute, V.EVA_SAMPLE_SPACING_M);
  const hoursEach = samples.length > 0 ? evaHours / samples.length : 0;

  const entries: ScheduleEntry[] = [
    { label: 'Habitat', doseRateRemYr: habRate, hoursPerDay: inp.habitatHoursPerDay, shieldFactor: inp.habitatShieldFactor },
  ];
  const sampleInCone: boolean[] = [];
  let masked = 0;
  for (const p of samples) {
    const rate = doseRate(p, reactor, shieldAngleDeg, terrain, k, berms);
    const open = doseRate(p, reactor, shieldAngleDeg, flat(terrain), k);
    if (rate < open * MASKED_BELOW) masked++;
    sampleInCone.push(inShieldCone(p, reactor, shieldAngleDeg));
    entries.push({ label: 'EVA', doseRateRemYr: rate, hoursPerDay: hoursEach, shieldFactor: 1 });
  }

  const { totalMsv, byEntryMsv } = annualDose({ missionDays: inp.missionDays, entries });
  let evaIn = 0;
  let evaOut = 0;
  sampleInCone.forEach((inside, i) => {
    if (inside) evaIn += byEntryMsv[i + 1];
    else evaOut += byEntryMsv[i + 1];
  });
  let routeLen = 0;
  for (let i = 0; i + 1 < inp.evaRoute.length; i++) routeLen += distance(inp.evaRoute[i], inp.evaRoute[i + 1]);

  return {
    reactorMsv: totalMsv,
    habitatMsv: byEntryMsv[0],
    evaMsv: evaIn + evaOut,
    evaInConeMsv: evaIn,
    evaOutConeMsv: evaOut,
    evaFractionOutsideCone: samples.length ? sampleInCone.filter((s) => !s).length / samples.length : 0,
    evaFractionMasked: samples.length ? masked / samples.length : 0,
    habitatOutdoorRateRemYr: habRate,
    habitatInCone: inShieldCone(habitat, reactor, shieldAngleDeg),
    habitatMasked: habRate < habUnshielded * MASKED_BELOW,
    evaHoursPerDay: evaHours,
    backgroundMsv: backgroundDoseMsv(inp.missionDays),
    routeLengthM: routeLen,
  };
}

function flat(t: TerrainLike): TerrainLike {
  return { widthM: t.widthM, heightM: t.heightM, resolutionM: t.resolutionM, elevationAt: () => 0 };
}
