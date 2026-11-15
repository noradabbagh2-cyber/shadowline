import { useEffect, useMemo, useState } from 'react';
import { V } from './physics/constants';
import { computeDoseField } from './physics/field';
import type { Terrain } from './physics/terrain';
import { explain } from './game/explain';
import { LEVELS, defaultSettings, referenceLayout } from './game/levels';
import { evaluate } from './game/scoring';
import type { Layout, Settings } from './game/types';
import { AssumptionsDrawer } from './ui/AssumptionsDrawer';
import { MapCanvas, type Tool } from './ui/MapCanvas';
import { Controls, Readouts, Verdict } from './ui/Panel';
import { DECADES, doseColor } from './ui/heatmap';
import { fmtInt } from './ui/format';
import { loadTerrain } from './ui/loadTerrain';

/** Heatmap grid size: coarse while dragging so the map stays live, fine when idle. */
const FIELD_N_DRAG = 56;
const FIELD_N_IDLE = 200;

export function App() {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadTerrain().then(setTerrain, (e) => setError(String(e)));
  }, []);
  if (error) return <div className="loading">Could not load terrain: {error}</div>;
  if (!terrain) return <div className="loading">Loading lunar terrain…</div>;
  return <Game terrain={terrain} />;
}

function Game({ terrain }: { terrain: Terrain }) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [layout, setLayout] = useState<Layout>(referenceLayout);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tool, setTool] = useState<Tool>('move');
  const [dragging, setDragging] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [scores, setScores] = useState<(number | null)[]>([null, null]);
  const [summary, setSummary] = useState(false);

  const level = LEVELS[levelIndex];
  const ev = useMemo(() => evaluate(layout, settings, level, terrain), [layout, settings, level, terrain]);
  const ex = useMemo(() => explain(ev, level), [ev, level]);

  const n = dragging ? FIELD_N_DRAG : FIELD_N_IDLE;
  const field = useMemo(
    () =>
      computeDoseField(
        terrain,
        { pos: layout.reactor, aim: layout.habitat },
        V.SHIELD_CONE_ANGLE_DEG,
        settings.k,
        layout.berms,
        n,
      ),
    [terrain, layout.reactor, layout.habitat, layout.berms, settings.k, n],
  );

  const changeSettings = (s: Settings) => {
    setSettings(s);
    if (s.bermThicknessM !== settings.bermThicknessM) {
      setLayout((l) => ({ ...l, berms: l.berms.map((b) => ({ ...b, thicknessM: s.bermThicknessM })) }));
    }
  };

  const submit = () => {
    const next = scores.slice();
    next[levelIndex] = ev.score;
    setScores(next);
    if (levelIndex === 0) setLevelIndex(1);
    else setSummary(true);
  };

  const restart = () => {
    setLayout(referenceLayout());
    setSettings(defaultSettings());
    setScores([null, null]);
    setLevelIndex(0);
    setSummary(false);
    setTool('move');
  };

  const legendStops = useMemo(() => {
    const stops: string[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = -DECADES + (2 * DECADES * i) / steps;
      const [r, g, b, a] = doseColor(10 ** t);
      stops.push(`rgba(${r | 0},${g | 0},${b | 0},${(Math.max(a, 40) / 255).toFixed(2)}) ${((i / steps) * 100).toFixed(1)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, []);
  const limit = V.CREW_LIMIT_NUCLEAR_MSV;

  return (
    <div className="app">
      <main className="stage">
        <MapCanvas
          terrain={terrain}
          layout={layout}
          level={level}
          settings={settings}
          field={field}
          tool={tool}
          showHeatmap={showHeatmap}
          onLayout={setLayout}
          onDragging={setDragging}
          onToolDone={() => setTool('move')}
        />
        <div className="toolbar">
          <button className={tool === 'waypoint' ? 'active' : ''} onClick={() => setTool(tool === 'waypoint' ? 'move' : 'waypoint')}>
            Add EVA waypoint
          </button>
          <button className={tool === 'berm' ? 'active' : ''} onClick={() => setTool(tool === 'berm' ? 'move' : 'berm')}>
            Build berm
          </button>
          {layout.waypoints.length > 0 && (
            <button className="ghost" onClick={() => setLayout({ ...layout, waypoints: [] })}>
              Clear {layout.waypoints.length} waypoint{layout.waypoints.length > 1 ? 's' : ''}
            </button>
          )}
          {layout.berms.length > 0 && (
            <button className="ghost" onClick={() => setLayout({ ...layout, berms: layout.berms.slice(0, -1) })}>
              Remove last berm ({layout.berms.length})
            </button>
          )}
          <button className="ghost" onClick={() => setLayout(referenceLayout())}>
            Reset to 1 km layout
          </button>
          <label className="check">
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} /> Dose map
          </label>
        </div>
        {showHeatmap && (
          <div className="legend">
            <div className="legend-title">
              Reactor dose if you stood here outdoors all {level.missionDays} days (mSv)
            </div>
            <div className="legend-bar" style={{ background: legendStops }} />
            <div className="legend-ticks">
              {[-2, -1, 0, 1, 2].map((d) => (
                <span key={d} className={d === 0 ? 'limit' : ''}>
                  {(limit * 10 ** d).toLocaleString('en-US')}
                </span>
              ))}
            </div>
            <div className="legend-note">
              <i className="swatch" /> White line: {limit} mSv crew limit · dashed: shield shadow edge
            </div>
          </div>
        )}
      </main>

      <aside className="panel">
        <header className="brand">
          <div>
            <h1>Shadowline</h1>
            <p>Lunar reactor siting game</p>
          </div>
          <button className="ghost" onClick={() => setDrawer(true)}>
            Assumptions
          </button>
        </header>

        <nav className="levels">
          {LEVELS.map((l, i) => {
            const locked = i === 1 && scores[0] === null;
            return (
              <button
                key={l.id}
                className={i === levelIndex ? 'active' : ''}
                disabled={locked}
                onClick={() => setLevelIndex(i)}
                title={locked ? 'Submit Level 1 first' : undefined}
              >
                <span>Level {l.id}</span>
                <b>{l.name}</b>
                <small>
                  {l.missionDays} days{scores[i] !== null ? ` · ${fmtInt(scores[i]!)} pts` : locked ? ' · locked' : ''}
                </small>
              </button>
            );
          })}
        </nav>

        <p className="brief">{level.brief}</p>

        <Verdict ev={ev} ex={ex} />

        <button className="primary" disabled={!ev.withinLimit} onClick={submit} data-testid="submit">
          {ev.withinLimit
            ? levelIndex === 0
              ? 'Submit layout and extend the mission'
              : 'Submit outpost layout'
            : 'Over the limit: redesign to submit'}
        </button>

        <Readouts ev={ev} level={level} />
        <Controls settings={settings} onChange={changeSettings} />

        <footer className="muted">
          A planning game built on a simplified dose model. Results hold only under the listed assumptions and are not
          a radiation protection assessment. Terrain: LOLA {terrain.meta.site} ({terrain.meta.name}).
        </footer>
      </aside>

      {drawer && <AssumptionsDrawer terrain={terrain} onClose={() => setDrawer(false)} />}

      {summary && (
        <div className="drawer-backdrop center" onClick={() => setSummary(false)}>
          <div className="summary" role="dialog" aria-label="Mission summary" onClick={(e) => e.stopPropagation()}>
            <h2>Outpost layout accepted</h2>
            <p>
              Level 1: <b>{fmtInt(scores[0] ?? 0)} pts</b> · Level 2: <b>{fmtInt(scores[1] ?? 0)} pts</b> · Total:{' '}
              <b>{fmtInt((scores[0] ?? 0) + (scores[1] ?? 0))} pts</b>
            </p>
            <p>
              The published 1 km layout is within the {limit} mSv crew limit for a {V.MISSION_DAYS_SORTIE}-day visit
              because the crew goes home. Stay for {V.MISSION_DAYS_OUTPOST} days and the same layout is over the
              limit, so a permanent base has to buy dose back with distance (more cable mass), shielding (more regolith
              moved), terrain, or routes that stay in the shield shadow.
            </p>
            <p className="muted">
              Your layout is within NASA-STD-3001 limits under this game&apos;s assumptions. Open Assumptions to see
              what the model leaves out.
            </p>
            <div className="row">
              <button className="primary" onClick={() => setSummary(false)}>
                Keep improving the score
              </button>
              <button className="ghost" onClick={restart}>
                Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
