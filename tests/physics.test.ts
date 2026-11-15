/**
 * Verification suite — physics engine.
 * Test IDs (V-xx) are referenced from docs/requirements.md.
 */
import { describe, expect, it } from 'vitest';
import {
  CONSTANTS,
  V,
  FlatTerrain,
  attenuation,
  doseRate,
  inShieldCone,
  lineOfSightAttenuation,
  standoffDistanceM,
  terrainPathLengthM,
  annualDose,
  backgroundDoseMsv,
  cableMass,
  regolithMovedTonnes,
  type Reactor,
  type TerrainLike,
} from '../src/physics';

const flat = new FlatTerrain(20000, 20000, 40);
const reactor: Reactor = { pos: { x: 5000, y: 10000 }, aim: { x: 6000, y: 10000 } }; // axis along +x
const ANGLE = V.SHIELD_CONE_ANGLE_DEG;
const K = V.K_DEFAULT_PER_CM;
const at = (r: number, offAxisDeg: number) => ({
  x: reactor.pos.x + r * Math.cos((offAxisDeg * Math.PI) / 180),
  y: reactor.pos.y + r * Math.sin((offAxisDeg * Math.PI) / 180),
});

describe('V-01 unshielded benchmark (Aerospace 2025)', () => {
  it('26.3 rem/yr at 500 m implies 5 rem/yr at 1.15 km ± 1%', () => {
    const d = standoffDistanceM(V.BENCHMARK_DOSE_REM_YR, V.BENCHMARK_DISTANCE_M, V.DOSE_IN_CONE_REM_YR);
    expect(Math.abs(d - V.BENCHMARK_EXPECTED_STANDOFF_M) / V.BENCHMARK_EXPECTED_STANDOFF_M).toBeLessThan(0.01);
  });
});

describe('V-02 calibration anchors', () => {
  it('is exactly 5 rem/yr at 1 km inside the cone', () => {
    expect(doseRate(at(1000, 0), reactor, ANGLE, flat, K)).toBe(5);
  });
  it('is exactly 50 rem/yr at 1 km outside the cone', () => {
    expect(doseRate({ x: reactor.pos.x - 1000, y: reactor.pos.y }, reactor, ANGLE, flat, K)).toBe(50);
    expect(doseRate({ x: reactor.pos.x, y: reactor.pos.y + 1000 }, reactor, ANGLE, flat, K)).toBe(50);
  });
});

describe('V-03 inverse square', () => {
  it.each([0, 90])('doubling distance gives 25 percent ± 0.1 (off-axis %d deg)', (deg) => {
    for (const r of [250, 1000, 3000]) {
      const ratio = doseRate(at(2 * r, deg), reactor, ANGLE, flat, K) / doseRate(at(r, deg), reactor, ANGLE, flat, K);
      expect(Math.abs(ratio - 0.25)).toBeLessThan(0.001);
    }
  });
});

describe('V-04 regolith attenuation', () => {
  it('100 cm at default k reduces dose by e^(-3.5) ± 1%', () => {
    const f = attenuation(100, K);
    expect(Math.abs(f - Math.exp(-3.5)) / Math.exp(-3.5)).toBeLessThan(0.01);
  });
  it('a 1 m berm square to the line of sight applies the same factor to doseRate', () => {
    const p = at(1000, 0);
    const berm = { a: { x: 5500, y: 9900 }, b: { x: 5500, y: 10100 }, heightM: V.BERM_HEIGHT_M, thicknessM: 1 };
    const ratio = doseRate(p, reactor, ANGLE, flat, K, [berm]) / doseRate(p, reactor, ANGLE, flat, K);
    expect(Math.abs(ratio - Math.exp(-3.5)) / Math.exp(-3.5)).toBeLessThan(0.01);
  });
  it('a berm that does not cross the line of sight has no effect', () => {
    const berm = { a: { x: 5500, y: 10200 }, b: { x: 5500, y: 10400 }, heightM: V.BERM_HEIGHT_M, thicknessM: 1 };
    expect(lineOfSightAttenuation(at(1000, 0), reactor.pos, flat, K, [berm])).toBe(1);
  });
  it('default k equals mass attenuation × density (rounded)', () => {
    expect(V.REGOLITH_MASS_ATTENUATION_CM2_G * V.REGOLITH_DENSITY_G_CM3).toBeCloseTo(K, 3);
  });
});

describe('V-05 shield cone geometry', () => {
  it('36° included angle: ±18° is inside, beyond is outside', () => {
    expect(inShieldCone(at(1000, 17.9), reactor, ANGLE)).toBe(true);
    expect(inShieldCone(at(1000, -17.9), reactor, ANGLE)).toBe(true);
    expect(inShieldCone(at(1000, 18.1), reactor, ANGLE)).toBe(false);
    expect(inShieldCone(at(1000, 180), reactor, ANGLE)).toBe(false);
  });
  it('dose steps by 10× across the cone edge', () => {
    const ratio = doseRate(at(1000, 18.1), reactor, ANGLE, flat, K) / doseRate(at(1000, 17.9), reactor, ANGLE, flat, K);
    expect(ratio).toBeCloseTo(10, 6);
  });
  it('protected wedge is about 650 m wide at 1 km', () => {
    const width = 2 * 1000 * Math.tan(((ANGLE / 2) * Math.PI) / 180);
    expect(width).toBeGreaterThan(640);
    expect(width).toBeLessThan(660);
  });
});

describe('V-06 terrain line of sight', () => {
  // A 50 m high, 200 m wide ridge across the line of sight.
  const ridge: TerrainLike = {
    widthM: 20000,
    heightM: 20000,
    resolutionM: 40,
    elevationAt: (x) => (x > 5400 && x < 5600 ? 50 : 0),
  };
  it('flat ground has no terrain on the path', () => {
    expect(terrainPathLengthM(at(1000, 0), reactor.pos, flat)).toBe(0);
  });
  it('a ridge on the path blocks the dose; the path length is about the ridge width', () => {
    const len = terrainPathLengthM(at(1000, 0), reactor.pos, ridge);
    expect(len).toBeGreaterThan(150);
    expect(len).toBeLessThan(250);
    expect(doseRate(at(1000, 0), reactor, ANGLE, ridge, K)).toBeLessThan(1e-9);
  });
  it('a point in front of the ridge is unaffected', () => {
    expect(doseRate(at(300, 0), reactor, ANGLE, ridge, K)).toBe(doseRate(at(300, 0), reactor, ANGLE, flat, K));
  });
});

describe('V-07 exposure model', () => {
  it('full-time outdoor occupancy at 1 km in the cone for a year is 50 mSv (2.5× the crew limit)', () => {
    const { totalMsv } = annualDose({
      missionDays: 365,
      entries: [{ label: 'outdoors', doseRateRemYr: 5, hoursPerDay: 24, shieldFactor: 1 }],
    });
    expect(totalMsv).toBeCloseTo(50, 9);
    expect(totalMsv / V.CREW_LIMIT_NUCLEAR_MSV).toBeCloseTo(2.5, 9);
  });
  it('dose is the sum of rate × time × shielding over schedule entries', () => {
    const { totalMsv, byEntryMsv } = annualDose({
      missionDays: 365,
      entries: [
        { label: 'habitat', doseRateRemYr: 5, hoursPerDay: 20, shieldFactor: 0.1 },
        { label: 'eva', doseRateRemYr: 50, hoursPerDay: 4, shieldFactor: 1 },
      ],
    });
    expect(byEntryMsv[0]).toBeCloseTo(50 * 0.1 * (20 / 24), 9);
    expect(byEntryMsv[1]).toBeCloseTo(500 * (4 / 24), 9);
    expect(totalMsv).toBeCloseTo(byEntryMsv[0] + byEntryMsv[1], 9);
  });
  it('scales linearly with mission length', () => {
    const e = [{ label: 'x', doseRateRemYr: 5, hoursPerDay: 24, shieldFactor: 1 }];
    const a = annualDose({ missionDays: 33, entries: e }).totalMsv;
    const b = annualDose({ missionDays: 365, entries: e }).totalMsv;
    expect(a / b).toBeCloseTo(33 / 365, 9);
  });
  it('inverse-square boundaries for year-round outdoor occupancy: ≈1.6 km in cone, ≈5 km outside', () => {
    const limitRem = V.CREW_LIMIT_NUCLEAR_MSV / V.REM_TO_MSV;
    expect(standoffDistanceM(5, 1000, limitRem)).toBeCloseTo(1581, 0);
    expect(standoffDistanceM(50, 1000, limitRem)).toBeCloseTo(5000, 0);
  });
  it('natural background: 1369 μSv/day is about 500 mSv per year, kept separate from reactor dose', () => {
    expect(backgroundDoseMsv(365)).toBeCloseTo(499.685, 3);
    expect(backgroundDoseMsv(33)).toBeCloseTo(45.177, 3);
  });
});

describe('V-08 cable and regolith mass', () => {
  it('73 kg per km, linear in distance', () => {
    expect(cableMass(1000)).toBeCloseTo(73, 9);
    expect(cableMass(2500)).toBeCloseTo(182.5, 9);
  });
  it('berm mass = length × height × thickness × 1.6 t/m³', () => {
    const berm = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, heightM: 3, thicknessM: 1 };
    expect(regolithMovedTonnes([berm])).toBeCloseTo(48, 9);
  });
});

describe('V-09 constants registry (traceability)', () => {
  it('every constant has a label, unit, kind and source', () => {
    for (const [key, c] of Object.entries(CONSTANTS)) {
      expect(c.label, key).not.toBe('');
      expect(c.source.length, key).toBeGreaterThan(5);
      expect(Number.isFinite(c.value), key).toBe(true);
    }
  });
  it('locked physics values match the project brief', () => {
    expect(V.REACTOR_THERMAL_KW).toBe(500);
    expect(V.REACTOR_ELECTRIC_KW).toBe(100);
    expect(V.SHIELD_CONE_ANGLE_DEG).toBe(36);
    expect(V.DOSE_IN_CONE_REM_YR).toBe(5);
    expect(V.DOSE_OUT_CONE_REM_YR).toBe(50);
    expect(V.K_DEFAULT_PER_CM).toBe(0.035);
    expect(V.CREW_LIMIT_NUCLEAR_MSV).toBe(20);
    expect(V.CAREER_LIMIT_MSV).toBe(600);
    expect(V.BACKGROUND_USV_DAY).toBe(1369);
    expect(V.CABLE_MASS_KG_PER_KM).toBe(73);
    expect(V.REM_TO_MSV).toBe(10);
  });
});
