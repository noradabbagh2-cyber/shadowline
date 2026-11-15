/**
 * Shadowline — single source of truth for every numeric constant.
 *
 * RULES
 *  - Every number used by the physics engine, the game, or shown on screen
 *    lives here, with a source. No magic numbers elsewhere.
 *  - The Assumptions drawer renders this registry directly, so anything the
 *    app uses is automatically listed with its source.
 *  - `kind` says how far to trust the value:
 *      sourced     published value, cited
 *      derived     arithmetic on sourced values (formula given)
 *      scenario    gameplay / mission-scenario choice the player can change or
 *                  that defines a level; NOT a published value
 *      modeling    simplification needed to make the model run; UNVERIFIED
 *      game        scoring weight; a game-design choice, not physics
 */

export type ConstantKind = 'sourced' | 'derived' | 'scenario' | 'modeling' | 'game';

export interface Constant {
  value: number;
  unit: string;
  label: string;
  kind: ConstantKind;
  /** Where the number comes from (citation, or the reasoning for non-sourced kinds). */
  source: string;
  url?: string;
  note?: string;
}

const SRC_NETS =
  'ORNL / LANL / NASA Glenn, Fission Surface Power shielding study, NETS 2026 (NTRS 20260002525); INL FSP webinar 2024';
const URL_NETS = 'https://ntrs.nasa.gov/citations/20260002525';
const SRC_AERO = 'Aerospace 2025, 12(1), 58';
const URL_AERO = 'https://doi.org/10.3390/aerospace12010058';
const SRC_STD = 'NASA-STD-3001, Vol. 1 (crew radiation limits)';
const SRC_GLENN = 'NASA Glenn 40 kWe Fission Surface Power concept (NTRS 20220007008)';
const URL_GLENN = 'https://ntrs.nasa.gov/citations/20220007008';

export const CONSTANTS = {
  // ---------------------------------------------------------------- reactor
  REACTOR_THERMAL_KW: {
    value: 500,
    unit: 'kWth',
    label: 'Reactor thermal power',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
  },
  REACTOR_ELECTRIC_KW: {
    value: 100,
    unit: 'kWe',
    label: 'Reactor electrical output',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
  },
  SHIELD_CONE_ANGLE_DEG: {
    value: 36,
    unit: '° (included)',
    label: 'Shadow-shield cone angle',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
    note: 'Full included angle; ±18° either side of the axis, which points at the habitat.',
  },
  DOSE_IN_CONE_REM_YR: {
    value: 5,
    unit: 'rem/yr at 1 km',
    label: 'Dose rate inside the shield shadow',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
    note: 'Design target, above lunar background, continuous occupancy.',
  },
  DOSE_OUT_CONE_REM_YR: {
    value: 50,
    unit: 'rem/yr at 1 km',
    label: 'Dose rate outside the shield shadow',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
  },
  REFERENCE_DISTANCE_M: {
    value: 1000,
    unit: 'm',
    label: 'Reference distance for the dose anchors',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
    note: 'Dose scales as (1000 m / r)² from these anchors.',
  },

  // -------------------------------------------------------------- shielding
  REGOLITH_MASS_ATTENUATION_CM2_G: {
    value: 0.0219,
    unit: 'cm²/g',
    label: 'Regolith mass attenuation coefficient (μ/ρ)',
    kind: 'sourced',
    source: SRC_AERO,
    url: URL_AERO,
    note: 'Single-coefficient, gamma-only, no scatter/build-up. The paper states its model is not validated.',
  },
  REGOLITH_DENSITY_G_CM3: {
    value: 1.6,
    unit: 'g/cm³',
    label: 'Regolith bulk density',
    kind: 'sourced',
    source: SRC_AERO,
    url: URL_AERO,
  },
  K_DEFAULT_PER_CM: {
    value: 0.035,
    unit: '1/cm',
    label: 'Regolith attenuation coefficient k (CONTESTED PARAMETER)',
    kind: 'derived',
    source: `${SRC_AERO}: μ/ρ × ρ = 0.0219 × 1.6 = 0.03504, rounded to 0.035`,
    url: URL_AERO,
    note: 'Dose is multiplied by e^(−k·x) for x cm of regolith on the line of sight. Adjustable with the k slider.',
  },
  K_SLIDER_MIN_PER_CM: {
    value: 0.005,
    unit: '1/cm',
    label: 'k slider minimum',
    kind: 'scenario',
    source: 'Slider range chosen for exploration; not a published bound.',
  },
  K_SLIDER_MAX_PER_CM: {
    value: 0.07,
    unit: '1/cm',
    label: 'k slider maximum',
    kind: 'scenario',
    source: 'Slider range chosen for exploration (2× default); not a published bound.',
  },

  // ----------------------------------------------------------------- limits
  CREW_LIMIT_NUCLEAR_MSV: {
    value: 20,
    unit: 'mSv per mission year',
    label: 'Crew limit for nuclear-source dose',
    kind: 'sourced',
    source: SRC_STD,
    note: '2 rem. Applies to reactor dose only, above background. This is the pass/fail limit in the game.',
  },
  CAREER_LIMIT_MSV: {
    value: 600,
    unit: 'mSv career',
    label: 'Career limit, all spaceflight radiation',
    kind: 'sourced',
    source: SRC_STD,
    note: 'A separate budget from the 20 mSv nuclear-source limit. Natural background counts here.',
  },
  REM_TO_MSV: {
    value: 10,
    unit: 'mSv per rem',
    label: 'Unit conversion',
    kind: 'sourced',
    source: 'Definition: 1 Sv = 100 rem',
  },
  BACKGROUND_USV_DAY: {
    value: 1369,
    unit: 'μSv/day',
    label: 'Natural lunar surface background',
    kind: 'sourced',
    source: "Zhang et al., Chang'e 4 Lunar Lander Neutrons and Dosimetry (LND), Science Advances 6 (2020) eaaz1334",
    url: 'https://doi.org/10.1126/sciadv.aaz1334',
    note: 'Shown separately. Never added to the 20 mSv reactor budget. Habitat shielding is NOT applied to it here.',
  },
  USV_PER_MSV: {
    value: 1000,
    unit: 'μSv per mSv',
    label: 'Unit conversion',
    kind: 'sourced',
    source: 'SI prefix definition',
  },

  // ------------------------------------------------------------------ cable
  CABLE_MASS_KG_PER_KM: {
    value: 73,
    unit: 'kg/km',
    label: 'Power cable mass at ±2800 VDC',
    kind: 'sourced',
    source: SRC_GLENN,
    url: URL_GLENN,
    note: 'ASSUMPTION: the 40 kWe figure is applied unchanged to the 100 kWe reactor and scaled linearly with straight-line distance.',
  },
  CABLE_VOLTAGE_VDC: {
    value: 2800,
    unit: '± VDC',
    label: 'Transmission voltage',
    kind: 'sourced',
    source: SRC_GLENN,
    url: URL_GLENN,
  },
  M_PER_KM: {
    value: 1000,
    unit: 'm per km',
    label: 'Unit conversion',
    kind: 'sourced',
    source: 'SI prefix definition',
  },

  // --------------------------------------------------------------- missions
  MISSION_DAYS_SORTIE: {
    value: 33,
    unit: 'days',
    label: 'Level 1 surface stay (Artemis sortie)',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
    note: 'The operational factor NASA uses to close the gap between the 5 rem/yr design target and the 2 rem crew limit.',
  },
  MISSION_DAYS_OUTPOST: {
    value: 365,
    unit: 'days',
    label: 'Level 2 surface stay (permanent outpost)',
    kind: 'scenario',
    source: 'One full mission year of continuous presence; scenario definition for Level 2.',
  },
  DAYS_PER_YEAR: {
    value: 365,
    unit: 'days',
    label: 'Days per year for rem/yr conversions',
    kind: 'sourced',
    source: 'Calendar year',
  },
  HOURS_PER_DAY: {
    value: 24,
    unit: 'h',
    label: 'Hours per day',
    kind: 'sourced',
    source: 'Definition',
  },
  HABITAT_SHIELD_FACTOR_DEFAULT: {
    value: 0.1,
    unit: '× outdoor dose',
    label: 'Habitat shielding factor (default)',
    kind: 'scenario',
    source: 'Player-set. Default from the project brief; not a published habitat design value.',
    note: 'Reactor dose rate inside the habitat = outdoor rate at that spot × this factor.',
  },
  HABITAT_SHIELD_FACTOR_MIN: {
    value: 0.05,
    unit: '× outdoor dose',
    label: 'Habitat shielding factor slider minimum',
    kind: 'scenario',
    source: 'Slider range; game choice, not a published habitat design value.',
  },
  HABITAT_HOURS_DEFAULT: {
    value: 20,
    unit: 'h/day',
    label: 'Hours per day inside the habitat (default)',
    kind: 'scenario',
    source: 'Player-set scenario value; not a published crew timeline.',
    note: 'The remaining hours are spent on the EVA route.',
  },
  MIN_EVA_HOURS: {
    value: 4,
    unit: 'h/day',
    label: 'Minimum daily EVA time (mission objective)',
    kind: 'scenario',
    source: 'Game rule so the science site must actually be visited; not a published crew timeline.',
  },

  // --------------------------------------------------------------- modeling
  SOURCE_HEIGHT_M: {
    value: 2,
    unit: 'm above ground',
    label: 'Reactor core height for line-of-sight',
    kind: 'modeling',
    source: 'UNVERIFIED modeling assumption (point source on a lander deck). Not from a published design.',
  },
  RECEPTOR_HEIGHT_M: {
    value: 1,
    unit: 'm above ground',
    label: 'Crew torso height for line-of-sight',
    kind: 'modeling',
    source: 'UNVERIFIED modeling assumption (approximate torso height of a standing astronaut).',
  },
  MIN_DISTANCE_M: {
    value: 10,
    unit: 'm',
    label: 'Minimum distance used in 1/r²',
    kind: 'modeling',
    source: 'Numerical guard only: a point-source 1/r² law diverges at r → 0.',
  },
  BERM_HEIGHT_M: {
    value: 3,
    unit: 'm',
    label: 'Regolith berm height',
    kind: 'modeling',
    source: 'UNVERIFIED game/modeling choice. Berms are rectangular walls of this height.',
  },
  BERM_THICKNESS_DEFAULT_M: {
    value: 1,
    unit: 'm',
    label: 'Berm thickness (default)',
    kind: 'scenario',
    source: 'Player-set. At default k, 1 m of regolith cuts dose by e^(−3.5) ≈ 30×.',
  },
  BERM_THICKNESS_MIN_M: {
    value: 0.25,
    unit: 'm',
    label: 'Berm thickness slider minimum',
    kind: 'scenario',
    source: 'Slider range; game choice.',
  },
  BERM_THICKNESS_MAX_M: {
    value: 3,
    unit: 'm',
    label: 'Berm thickness slider maximum',
    kind: 'scenario',
    source: 'Slider range; game choice.',
  },
  CM_PER_M: {
    value: 100,
    unit: 'cm per m',
    label: 'Unit conversion',
    kind: 'sourced',
    source: 'SI prefix definition',
  },
  KG_PER_TONNE: {
    value: 1000,
    unit: 'kg per t',
    label: 'Unit conversion',
    kind: 'sourced',
    source: 'Definition',
  },
  EVA_SAMPLE_SPACING_M: {
    value: 20,
    unit: 'm',
    label: 'EVA route sampling interval',
    kind: 'modeling',
    source: 'Numerical choice: EVA time is spread evenly along the route, sampled at this spacing.',
  },

  // -------------------------------------------------------------- benchmark
  BENCHMARK_DOSE_REM_YR: {
    value: 26.3,
    unit: 'rem/yr at 500 m',
    label: 'Verification benchmark: unshielded 10 kWe reactor',
    kind: 'sourced',
    source: SRC_AERO,
    url: URL_AERO,
    note: 'Used only by the test suite: inverse-square implies 5 rem/yr at ≈1.15 km.',
  },
  BENCHMARK_DISTANCE_M: {
    value: 500,
    unit: 'm',
    label: 'Verification benchmark distance',
    kind: 'sourced',
    source: SRC_AERO,
    url: URL_AERO,
  },
  BENCHMARK_EXPECTED_STANDOFF_M: {
    value: 1150,
    unit: 'm',
    label: 'Verification benchmark: expected 5 rem/yr distance',
    kind: 'derived',
    source: `${SRC_AERO}: 500 m × √(26.3 / 5) = 1146.7 m ≈ 1.15 km`,
    url: URL_AERO,
  },

  // ----------------------------------------------------------- level setup
  LAYOUT_REACTOR_X_M: {
    value: 5200,
    unit: 'm (map x)',
    label: 'Starting layout: reactor position, x',
    kind: 'scenario',
    source: 'Chosen on the Site04 tile: locally level ground near the Shackleton rim with clear line of sight to the habitat and science site.',
  },
  LAYOUT_REACTOR_Y_M: {
    value: 14000,
    unit: 'm (map y)',
    label: 'Starting layout: reactor position, y',
    kind: 'scenario',
    source: 'Chosen on the Site04 tile (see reactor x).',
  },
  LAYOUT_HABITAT_BEARING_DEG: {
    value: 340,
    unit: '° (map angle)',
    label: 'Starting layout: direction from reactor to habitat',
    kind: 'scenario',
    source: 'Chosen on the Site04 tile for clear line of sight.',
  },
  LAYOUT_HABITAT_DISTANCE_M: {
    value: 1000,
    unit: 'm',
    label: 'Starting layout: reactor-to-habitat standoff',
    kind: 'sourced',
    source: SRC_NETS,
    url: URL_NETS,
    note: 'The published 1 km standoff, with the habitat on the shield axis.',
  },
  LAYOUT_SITE_OFF_AXIS_DEG: {
    value: 40,
    unit: '° off the shield axis',
    label: 'Science site direction (fixed objective)',
    kind: 'scenario',
    source: 'Game scenario: the site is deliberately outside the 36° shadow in the starting layout.',
  },
  LAYOUT_SITE_DISTANCE_M: {
    value: 1000,
    unit: 'm from the starting reactor position',
    label: 'Science site distance (fixed objective)',
    kind: 'scenario',
    source: 'Game scenario; not a published site.',
  },

  // ------------------------------------------------------------------ score
  SCORE_POWER_POINTS_PER_KWE: {
    value: 10,
    unit: 'pts per kWe',
    label: 'Score: reward for power delivered',
    kind: 'game',
    source: 'Game-design weight. Line losses are not modeled, so a connected reactor delivers its full 100 kWe.',
  },
  SCORE_CABLE_PENALTY_PER_KG: {
    value: 1,
    unit: 'pts per kg',
    label: 'Score: cable mass penalty',
    kind: 'game',
    source: 'Game-design weight (launch mass is the budget).',
  },
  SCORE_REGOLITH_PENALTY_PER_TONNE: {
    value: 2,
    unit: 'pts per tonne',
    label: 'Score: regolith moved penalty',
    kind: 'game',
    source: 'Game-design weight (excavation effort).',
  },
  SCORE_DOSE_PENALTY_AT_LIMIT: {
    value: 400,
    unit: 'pts at 100% of limit',
    label: 'Score: ALARA dose penalty',
    kind: 'game',
    source: 'Game-design weight. Scales linearly with reactor dose ÷ 20 mSv limit, so lower dose always scores higher (ALARA).',
  },
} as const satisfies Record<string, Constant>;

export type ConstantKey = keyof typeof CONSTANTS;

/** Shorthand numeric accessor. */
export const V = Object.fromEntries(
  Object.entries(CONSTANTS).map(([k, c]) => [k, c.value]),
) as { readonly [K in ConstantKey]: number };

export const KIND_LABEL: Record<ConstantKind, string> = {
  sourced: 'Published value',
  derived: 'Derived from published values',
  scenario: 'Scenario setting (not a published value)',
  modeling: 'Modeling assumption (unverified)',
  game: 'Game scoring weight',
};
