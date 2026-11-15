import { V } from '../physics/constants';
import type { Vec2 } from '../physics/types';
import type { Layout, Level, Settings } from './types';

const DEG = Math.PI / 180;

function polar(origin: Vec2, bearingDeg: number, distanceM: number): Vec2 {
  return {
    x: origin.x + distanceM * Math.cos(bearingDeg * DEG),
    y: origin.y + distanceM * Math.sin(bearingDeg * DEG),
  };
}

const START_REACTOR: Vec2 = { x: V.LAYOUT_REACTOR_X_M, y: V.LAYOUT_REACTOR_Y_M };

/** Fixed mission objective: same place in both levels. */
export const SCIENCE_SITE: Vec2 = polar(
  START_REACTOR,
  V.LAYOUT_HABITAT_BEARING_DEG + V.LAYOUT_SITE_OFF_AXIS_DEG,
  V.LAYOUT_SITE_DISTANCE_M,
);

/** The published reference layout: habitat on the shield axis, 1 km from the reactor. */
export function referenceLayout(): Layout {
  return {
    reactor: { ...START_REACTOR },
    habitat: polar(START_REACTOR, V.LAYOUT_HABITAT_BEARING_DEG, V.LAYOUT_HABITAT_DISTANCE_M),
    waypoints: [],
    berms: [],
  };
}

export function defaultSettings(): Settings {
  return {
    habitatHoursPerDay: V.HABITAT_HOURS_DEFAULT,
    habitatShieldFactor: V.HABITAT_SHIELD_FACTOR_DEFAULT,
    k: V.K_DEFAULT_PER_CM,
    bermThicknessM: V.BERM_THICKNESS_DEFAULT_M,
  };
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'Artemis Sortie',
    missionDays: V.MISSION_DAYS_SORTIE,
    scienceSite: SCIENCE_SITE,
    brief:
      'A crew visits for 33 days. The reactor sits 1 km from the habitat, with its shadow shield pointed at the crew. Check the published layout against the crew limit, then submit it.',
  },
  {
    id: 2,
    name: 'Permanent Outpost',
    missionDays: V.MISSION_DAYS_OUTPOST,
    scienceSite: SCIENCE_SITE,
    brief:
      'Same base, but now the crew stays all year. Nothing on the map moved, yet the layout is over the limit. Redesign it: use distance, regolith berms, terrain, or an EVA route that stays in the shield shadow.',
  },
];
