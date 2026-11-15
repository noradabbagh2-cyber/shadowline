import { V } from '../physics/constants';
import type { Evaluation } from '../game/scoring';
import type { Explanation } from '../game/explain';
import type { Level, Settings } from '../game/types';
import { fmtDist, fmtInt, fmtMsv, fmtPct } from './format';

function Meter(p: { label: string; value: string; limit: string; fraction: number; tone: 'ok' | 'warn' | 'bad' | 'neutral'; note?: string }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{p.label}</span>
        <span>
          <b>{p.value}</b> <span className="muted">/ {p.limit}</span>
        </span>
      </div>
      <div className="bar">
        <div className={`fill ${p.tone}`} style={{ width: `${Math.min(p.fraction, 1) * 100}%` }} />
      </div>
      {p.note && <div className="note">{p.note}</div>}
    </div>
  );
}

function Slider(p: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  tag?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <div className="meter-head">
        <span>
          {p.label} {p.tag && <em className="tag">{p.tag}</em>}
        </span>
        <b>{p.display}</b>
      </div>
      <input
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
      {p.hint && <div className="note">{p.hint}</div>}
    </label>
  );
}

export function Verdict({ ev, ex }: { ev: Evaluation; ex: Explanation }) {
  return (
    <section className={`verdict ${ev.withinLimit ? 'ok' : 'bad'}`} data-testid="verdict">
      <h2>{ex.headline}</h2>
      {ex.reasons.map((r) => (
        <p key={r}>{r}</p>
      ))}
      {ex.suggestions.length > 0 && (
        <>
          <h3>{ev.withinLimit ? 'Keep going' : 'What you can change'}</h3>
          <ul>
            {ex.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Readouts({ ev, level }: { ev: Evaluation; level: Level }) {
  const x = ev.exposure;
  const doseTone = !ev.withinLimit ? 'bad' : ev.doseFractionOfLimit > 0.5 ? 'warn' : 'ok';
  const signed = (v: number) => (Math.round(v) < 0 ? `−${fmtInt(-v)}` : Math.round(v) > 0 ? `+${fmtInt(v)}` : '0');
  return (
    <section>
      <h3>Readouts vs limits</h3>
      <Meter
        label="Reactor dose, this mission"
        value={`${fmtMsv(x.reactorMsv)} mSv`}
        limit={`${V.CREW_LIMIT_NUCLEAR_MSV} mSv`}
        fraction={ev.doseFractionOfLimit}
        tone={doseTone}
        note={`Crew limit for nuclear sources (NASA-STD-3001), above background. Habitat ${fmtMsv(x.habitatMsv)} mSv + EVA ${fmtMsv(x.evaMsv)} mSv.`}
      />
      <Meter
        label="Natural background, this mission"
        value={`${fmtMsv(x.backgroundMsv)} mSv`}
        limit={`${V.CAREER_LIMIT_MSV} mSv career`}
        fraction={ev.backgroundFractionOfCareer}
        tone="neutral"
        note={`A separate budget: ${fmtInt(V.BACKGROUND_USV_DAY)} μSv/day × ${level.missionDays} days of cosmic rays, counted against the career limit. Not part of the reactor budget, and no layout changes it.`}
      />
      <div className="stats">
        <div>
          <span>Power delivered</span>
          <b>{ev.powerKwe} kWe</b>
        </div>
        <div>
          <span>Cable</span>
          <b>
            {fmtDist(ev.cableLengthM)} · {fmtInt(ev.cableKg)} kg
          </b>
        </div>
        <div>
          <span>Regolith moved</span>
          <b>{fmtInt(ev.regolithTonnes)} t</b>
        </div>
        <div>
          <span>EVA route</span>
          <b>
            {fmtDist(x.routeLengthM)} · {fmtPct(1 - x.evaFractionOutsideCone)} in shadow
          </b>
        </div>
      </div>
      <div className="score" data-testid="score">
        <div className="score-main">
          <span>Score</span>
          <b>{ev.withinLimit ? fmtInt(ev.score) : 'No score: over limit'}</b>
        </div>
        <div className="note">
          Power {signed(ev.scoreParts.power)} · cable {signed(ev.scoreParts.cable)} · regolith{' '}
          {signed(ev.scoreParts.regolith)} · dose (ALARA) {signed(ev.scoreParts.dose)}
        </div>
      </div>
    </section>
  );
}

export function Controls({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const evaHours = V.HOURS_PER_DAY - settings.habitatHoursPerDay;
  const bermFactor = Math.exp(settings.k * settings.bermThicknessM * V.CM_PER_M);
  return (
    <section>
      <h3>Crew schedule and shielding</h3>
      <Slider
        label="Hours per day inside the habitat"
        value={settings.habitatHoursPerDay}
        min={0}
        max={V.HOURS_PER_DAY - V.MIN_EVA_HOURS}
        step={1}
        display={`${settings.habitatHoursPerDay} h`}
        hint={`Leaves ${evaHours} h/day on the EVA route. The mission needs at least ${V.MIN_EVA_HOURS} h/day of EVA.`}
        onChange={(v) => onChange({ ...settings, habitatHoursPerDay: v })}
      />
      <Slider
        label="Habitat shielding factor"
        value={settings.habitatShieldFactor}
        min={V.HABITAT_SHIELD_FACTOR_MIN}
        max={1}
        step={0.05}
        display={`× ${settings.habitatShieldFactor.toFixed(2)}`}
        hint="Fraction of the outdoor reactor dose that reaches the crew indoors."
        onChange={(v) => onChange({ ...settings, habitatShieldFactor: v })}
      />
      <Slider
        label="Regolith attenuation k"
        tag="contested parameter"
        value={settings.k}
        min={V.K_SLIDER_MIN_PER_CM}
        max={V.K_SLIDER_MAX_PER_CM}
        step={0.005}
        display={`${settings.k.toFixed(3)} /cm`}
        hint={`How strongly regolith blocks radiation. Published default ${V.K_DEFAULT_PER_CM} /cm comes from an unvalidated gamma-only model.`}
        onChange={(v) => onChange({ ...settings, k: v })}
      />
      <Slider
        label="Berm thickness"
        value={settings.bermThicknessM}
        min={V.BERM_THICKNESS_MIN_M}
        max={V.BERM_THICKNESS_MAX_M}
        step={0.25}
        display={`${settings.bermThicknessM.toFixed(2)} m`}
        hint={`Berms are ${V.BERM_HEIGHT_M} m tall. At this k and thickness a berm cuts dose about ${bermFactor >= 1000 ? bermFactor.toExponential(0) : Math.round(bermFactor)}×.`}
        onChange={(v) => onChange({ ...settings, bermThicknessM: v })}
      />
    </section>
  );
}
