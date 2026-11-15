import type { Berm, Vec2 } from '../physics/types';

/** Everything the player places on the map. */
export interface Layout {
  reactor: Vec2;
  habitat: Vec2;
  /** Optional intermediate EVA waypoints between the habitat and the science site. */
  waypoints: Vec2[];
  berms: Berm[];
}

/** Everything the player sets with sliders. */
export interface Settings {
  habitatHoursPerDay: number;
  habitatShieldFactor: number;
  /** Regolith attenuation coefficient, 1/cm. */
  k: number;
  bermThicknessM: number;
}

export interface Level {
  id: 1 | 2;
  name: string;
  missionDays: number;
  /** Fixed mission objective the crew must reach on EVA. */
  scienceSite: Vec2;
  brief: string;
}
