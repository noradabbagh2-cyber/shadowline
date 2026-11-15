/** Plain-language verdicts. Never says "safe": only "within / over the limit under these assumptions". */
import { V } from '../physics/constants';
import type { Evaluation } from './scoring';
import type { Level } from './types';

export interface Explanation {
  headline: string;
  reasons: string[];
  suggestions: string[];
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const msv = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));

export function explain(ev: Evaluation, level: Level): Explanation {
  const x = ev.exposure;
  const limit = V.CREW_LIMIT_NUCLEAR_MSV;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  if (ev.withinLimit) {
    reasons.push(
      `Reactor dose over this ${level.missionDays}-day mission is ${msv(x.reactorMsv)} mSv, ${pct(ev.doseFractionOfLimit)} of the ${limit} mSv crew limit for nuclear sources.`,
    );
    reasons.push(
      `${msv(x.evaMsv)} mSv comes from ${x.evaHoursPerDay} h/day on the EVA route and ${msv(x.habitatMsv)} mSv from time inside the habitat.`,
    );
    if (ev.doseFractionOfLimit > 0.5) {
      suggestions.push('ALARA: the limit is a ceiling, not a target. Lower dose still scores higher.');
    }
    return {
      headline: 'Within NASA-STD-3001 limits under these assumptions',
      reasons,
      suggestions,
    };
  }

  reasons.push(
    `Reactor dose over this ${level.missionDays}-day mission is ${msv(x.reactorMsv)} mSv. That is ${ev.doseFractionOfLimit.toFixed(1)}× the ${limit} mSv crew limit for nuclear sources.`,
  );

  const evaShare = x.reactorMsv > 0 ? x.evaMsv / x.reactorMsv : 0;
  if (evaShare >= 0.5) {
    reasons.push(
      `${pct(evaShare)} of that dose is picked up outdoors, during ${x.evaHoursPerDay} h/day on the EVA route. A spacesuit gives no credit against reactor radiation in this model.`,
    );
    if (x.evaFractionOutsideCone > 0.05 && x.evaOutConeMsv > x.evaInConeMsv) {
      reasons.push(
        `${pct(x.evaFractionOutsideCone)} of the route lies outside the ${V.SHIELD_CONE_ANGLE_DEG}° shield shadow, where the dose rate is ${V.DOSE_OUT_CONE_REM_YR / V.DOSE_IN_CONE_REM_YR}× higher than inside it.`,
      );
      suggestions.push('Move the reactor so the habitat and the science site line up inside the shadow wedge.');
      suggestions.push('Build a regolith berm between the reactor and the exposed part of the route.');
      suggestions.push('Put a ridge or crater rim between the reactor and the route (terrain masking).');
    } else {
      reasons.push('The route stays in the shield shadow, but it is too close to the reactor for this mission length.');
    }
    suggestions.push('Move the reactor farther away. Doubling the distance cuts the dose to one quarter, but adds cable mass.');
  } else {
    reasons.push(
      `${pct(1 - evaShare)} of that dose is received inside the habitat, which sits ${x.habitatInCone ? 'inside' : 'OUTSIDE'} the shield shadow, even after the habitat shielding factor is applied.`,
    );
    suggestions.push('Increase the reactor-to-habitat distance, or improve the habitat shielding factor.');
  }

  if (level.missionDays > V.MISSION_DAYS_SORTIE) {
    reasons.push(
      `The same layout is within the limit for a ${V.MISSION_DAYS_SORTIE}-day stay only because the crew leaves: dose scales with days on the surface.`,
    );
  }

  return { headline: `Over the ${limit} mSv NASA-STD-3001 limit for nuclear sources`, reasons, suggestions };
}
