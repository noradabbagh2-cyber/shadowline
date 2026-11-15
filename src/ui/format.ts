export const fmtMsv = (v: number): string =>
  v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v > 0 ? '<0.01' : '0';

export const fmtDist = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

export const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US');

export const fmtPct = (f: number): string => `${Math.round(f * 100)}%`;

/** Full-precision display for the Assumptions drawer (no rounding of published values). */
export const fmtConst = (v: number): string => v.toLocaleString('en-US', { maximumFractionDigits: 6 });
