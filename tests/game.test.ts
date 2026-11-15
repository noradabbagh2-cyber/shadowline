/**
 * Verification suite — game levels, scoring and the shipped terrain tile.
 */
import { describe, expect, it } from 'vitest';
import { V, FlatTerrain, distance, inShieldCone, terrainPathLengthM } from '../src/physics';
import { LEVELS, SCIENCE_SITE, defaultSettings, referenceLayout } from '../src/game/levels';
import { evaluate, evaRoute } from '../src/game/scoring';
import { explain } from '../src/game/explain';
import { loadShippedTerrain } from './helpers';

const terrain = loadShippedTerrain();
const flat = new FlatTerrain(terrain.widthM, terrain.heightM, terrain.resolutionM);
const [level1, level2] = LEVELS;

describe('V-10 shipped terrain tile', () => {
  it('is one LOLA site tile at 20–50 m/px with finite elevations', () => {
    expect(terrain.meta.source_url).toContain('pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/');
    expect(terrain.resolutionM).toBeGreaterThanOrEqual(20);
    expect(terrain.resolutionM).toBeLessThanOrEqual(50);
    expect(terrain.data.every(Number.isFinite)).toBe(true);
    expect(terrain.data.byteLength).toBeLessThan(5e6);
  });
  it('reference layout has a clear line of sight on the real terrain', () => {
    const l = referenceLayout();
    expect(terrainPathLengthM(l.habitat, l.reactor, terrain)).toBe(0);
    expect(terrainPathLengthM(SCIENCE_SITE, l.reactor, terrain)).toBe(0);
  });
});

describe('V-11 reference layout geometry', () => {
  const l = referenceLayout();
  it('habitat is 1 km from the reactor, on the shield axis', () => {
    expect(distance(l.reactor, l.habitat)).toBeCloseTo(1000, 6);
    expect(inShieldCone(l.habitat, { pos: l.reactor, aim: l.habitat }, V.SHIELD_CONE_ANGLE_DEG)).toBe(true);
  });
  it('both levels use the same layout and the same science site', () => {
    expect(level1.scienceSite).toEqual(level2.scienceSite);
  });
});

describe.each([
  ['real Site04 terrain', terrain],
  ['flat ground', flat],
])('V-12 level outcomes with the 1 km reference layout (%s)', (_name, t) => {
  it('Level 1 (33 days) is within the 20 mSv limit', () => {
    const ev = evaluate(referenceLayout(), defaultSettings(), level1, t);
    expect(level1.missionDays).toBe(33);
    expect(ev.exposure.reactorMsv).toBeLessThan(V.CREW_LIMIT_NUCLEAR_MSV);
    expect(ev.withinLimit).toBe(true);
    expect(ev.score).toBeGreaterThan(0);
  });
  it('Level 2 (365 days) with the same layout is over the 20 mSv limit', () => {
    const ev = evaluate(referenceLayout(), defaultSettings(), level2, t);
    expect(level2.missionDays).toBe(365);
    expect(ev.exposure.reactorMsv).toBeGreaterThan(V.CREW_LIMIT_NUCLEAR_MSV);
    expect(ev.withinLimit).toBe(false);
    expect(ev.score).toBe(0);
  });
  it('the only difference between the two results is mission length', () => {
    const a = evaluate(referenceLayout(), defaultSettings(), level1, t).exposure.reactorMsv;
    const b = evaluate(referenceLayout(), defaultSettings(), level2, t).exposure.reactorMsv;
    expect(a / b).toBeCloseTo(33 / 365, 9);
  });
});

describe('V-13 Level 2 can be solved by each design lever', () => {
  const s = defaultSettings();
  const base = referenceLayout();
  const dir = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const d = distance(from, to);
    return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
  };
  it('shadow alignment: reactor in line with habitat and science site', () => {
    const u = dir(SCIENCE_SITE, base.habitat);
    const reactor = { x: base.habitat.x + u.x * 1000, y: base.habitat.y + u.y * 1000 };
    const ev = evaluate({ ...base, reactor }, s, level2, flat);
    expect(ev.exposure.evaFractionOutsideCone).toBe(0);
    expect(ev.withinLimit).toBe(true);
  });
  it('distance: moving the reactor far enough away', () => {
    const u = dir(base.habitat, base.reactor);
    const reactor = { x: base.habitat.x + u.x * 6000, y: base.habitat.y + u.y * 6000 };
    expect(evaluate({ ...base, reactor }, s, level2, flat).withinLimit).toBe(true);
  });
  it('berm: a regolith wall between reactor and the exposed route', () => {
    const route = evaRoute(base, level2);
    const mid = { x: (route[0].x + route[1].x) / 2, y: (route[0].y + route[1].y) / 2 };
    const u = dir(base.reactor, mid);
    const c = { x: base.reactor.x + u.x * 30, y: base.reactor.y + u.y * 30 };
    const berm = {
      a: { x: c.x - u.y * 20, y: c.y + u.x * 20 },
      b: { x: c.x + u.y * 20, y: c.y - u.x * 20 },
      heightM: V.BERM_HEIGHT_M,
      thicknessM: s.bermThicknessM,
    };
    const ev = evaluate({ ...base, berms: [berm] }, s, level2, flat);
    expect(ev.withinLimit).toBe(true);
    expect(ev.regolithTonnes).toBeGreaterThan(0);
  });
});

describe('V-13b berm on the real terrain', () => {
  it('a berm 10 m from the reactor brings Level 2 within the limit; the same berm 25 m out is overlooked by the higher route', () => {
    const s = defaultSettings();
    const base = referenceLayout();
    const mid = { x: (base.habitat.x + SCIENCE_SITE.x) / 2, y: (base.habitat.y + SCIENCE_SITE.y) / 2 };
    const d = distance(base.reactor, mid);
    const u = { x: (mid.x - base.reactor.x) / d, y: (mid.y - base.reactor.y) / d };
    const bermAt = (standoffM: number, halfLengthM: number) => {
      const c = { x: base.reactor.x + u.x * standoffM, y: base.reactor.y + u.y * standoffM };
      return {
        a: { x: c.x - u.y * halfLengthM, y: c.y + u.x * halfLengthM },
        b: { x: c.x + u.y * halfLengthM, y: c.y - u.x * halfLengthM },
        heightM: V.BERM_HEIGHT_M,
        thicknessM: s.bermThicknessM,
      };
    };
    const near = evaluate({ ...base, berms: [bermAt(10, 12)] }, s, level2, terrain);
    expect(near.withinLimit).toBe(true);
    expect(near.exposure.evaFractionMasked).toBeGreaterThan(0.9);
    // The route is 40-55 m above the reactor here, so sight lines climb over a 3 m wall placed farther out.
    const far = evaluate({ ...base, berms: [bermAt(25, 30)] }, s, level2, terrain);
    expect(far.exposure.evaFractionMasked).toBe(0);
    expect(far.withinLimit).toBe(false);
  });
});

describe('V-14 scoring', () => {
  const s = defaultSettings();
  it('lower dose scores higher, all else equal (ALARA)', () => {
    const a = evaluate(referenceLayout(), s, level1, flat);
    const b = evaluate(referenceLayout(), { ...s, habitatShieldFactor: 0.05 }, level1, flat);
    expect(b.exposure.reactorMsv).toBeLessThan(a.exposure.reactorMsv);
    expect(b.score).toBeGreaterThan(a.score);
  });
  it('score parts for the reference layout: power +1000, cable −73 (1 km), regolith 0', () => {
    const a = evaluate(referenceLayout(), s, level1, flat);
    expect(a.scoreParts.cable).toBeCloseTo(-73, 6);
    expect(a.scoreParts.regolith).toBeCloseTo(0, 12);
    expect(a.scoreParts.power).toBe(1000);
  });
});

describe('V-15 explanations and wording', () => {
  const s = defaultSettings();
  it('a failing layout explains why, in plain language, with numbers', () => {
    const ev = evaluate(referenceLayout(), s, level2, terrain);
    const ex = explain(ev, level2);
    expect(ex.headline).toMatch(/Over the 20 mSv/);
    expect(ex.reasons.length).toBeGreaterThanOrEqual(2);
    expect(ex.reasons.join(' ')).toMatch(/outside the 36° shield shadow/);
    expect(ex.suggestions.length).toBeGreaterThan(0);
  });
  it('never calls a layout "safe"', () => {
    for (const level of LEVELS) {
      const ex = explain(evaluate(referenceLayout(), s, level, terrain), level);
      const text = [ex.headline, ...ex.reasons, ...ex.suggestions, level.brief].join(' ');
      expect(text).not.toMatch(/\bsafe\b/i);
    }
    const ok = explain(evaluate(referenceLayout(), s, level1, terrain), level1);
    expect(ok.headline).toBe('Within NASA-STD-3001 limits under these assumptions');
  });
});
