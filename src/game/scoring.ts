/**
 * Layout evaluation and scoring.
 *
 * Hard rule: reactor dose over the mission above the NASA-STD-3001
 * nuclear-source limit (20 mSv per mission year) fails the layout outright.
 * Otherwise: score = power reward − cable penalty − regolith penalty − ALARA dose penalty.
 * All weights are game-design choices, listed in constants.ts.
 */
import { V } from '../physics/constants';
import { cableMass, regolithMovedTonnes } from '../physics/cable';
import { distance } from '../physics/dose';
import { computeExposure, type ExposureResult } from '../physics/exposure';
import type { TerrainLike } from '../physics/types';
import type { Layout, Level, Settings } from './types';

export interface Evaluation {
  exposure: ExposureResult;
  /** Reactor dose ÷ 20 mSv limit. */
  doseFractionOfLimit: number;
  backgroundFractionOfCareer: number;
  cableLengthM: number;
  cableKg: number;
  regolithTonnes: number;
  powerKwe: number;
  withinLimit: boolean;
  score: number;
  scoreParts: { power: number; cable: number; regolith: number; dose: number };
}

export function evaRoute(layout: Layout, level: Level) {
  return [layout.habitat, ...layout.waypoints, level.scienceSite];
}

export function evaluate(layout: Layout, settings: Settings, level: Level, terrain: TerrainLike): Evaluation {
  const exposure = computeExposure({
    reactor: { pos: layout.reactor, aim: layout.habitat },
    habitat: layout.habitat,
    evaRoute: evaRoute(layout, level),
    berms: layout.berms,
    terrain,
    k: settings.k,
    shieldAngleDeg: V.SHIELD_CONE_ANGLE_DEG,
    missionDays: level.missionDays,
    habitatHoursPerDay: settings.habitatHoursPerDay,
    habitatShieldFactor: settings.habitatShieldFactor,
  });
  const cableLengthM = distance(layout.reactor, layout.habitat);
  const cableKg = cableMass(cableLengthM);
  const regolithTonnes = regolithMovedTonnes(layout.berms);
  const powerKwe = V.REACTOR_ELECTRIC_KW;
  const doseFractionOfLimit = exposure.reactorMsv / V.CREW_LIMIT_NUCLEAR_MSV;
  const withinLimit = exposure.reactorMsv <= V.CREW_LIMIT_NUCLEAR_MSV;

  const scoreParts = {
    power: powerKwe * V.SCORE_POWER_POINTS_PER_KWE,
    cable: -cableKg * V.SCORE_CABLE_PENALTY_PER_KG,
    regolith: -regolithTonnes * V.SCORE_REGOLITH_PENALTY_PER_TONNE,
    dose: -doseFractionOfLimit * V.SCORE_DOSE_PENALTY_AT_LIMIT,
  };
  const raw = scoreParts.power + scoreParts.cable + scoreParts.regolith + scoreParts.dose;

  return {
    exposure,
    doseFractionOfLimit,
    backgroundFractionOfCareer: exposure.backgroundMsv / V.CAREER_LIMIT_MSV,
    cableLengthM,
    cableKg,
    regolithTonnes,
    powerKwe,
    withinLimit,
    score: withinLimit ? Math.max(0, Math.round(raw)) : 0,
    scoreParts,
  };
}
