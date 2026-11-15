import { CONSTANTS, KIND_LABEL, V, type Constant, type ConstantKind } from '../physics/constants';
import { fmtConst } from './format';
import type { Terrain } from '../physics/terrain';

const ORDER: ConstantKind[] = ['sourced', 'derived', 'scenario', 'modeling', 'game'];

const LIMITATIONS = [
  'No neutron scatter or skyshine. Only the straight line of sight counts, so berms and terrain look more effective here than they would be. ORNL’s Monte Carlo work found scatter off the lander and the surface noticeably raises dose behind the shield.',
  'Point source. Distance is horizontal map distance, which is never longer than the true slant distance (conservative).',
  'Uniform regolith with one attenuation coefficient k for all radiation (gamma-only assumption from the Aerospace 2025 paper, which states its model is not validated).',
  'The shield shadow is a flat wedge on the map (flat-ground cone geometry). Elevation differences do not tilt it.',
  'Cable mass uses the 40 kWe reference figure, scaled linearly, as a straight line. Line losses are not modeled.',
  'Natural background is the unshielded surface value. It is shown for scale against the career limit and is never added to the reactor budget.',
  'Not validated against a transport code. Next step: compare with OpenMC.',
];

export function AssumptionsDrawer({ terrain, onClose }: { terrain: Terrain; onClose: () => void }) {
  const entries = Object.entries(CONSTANTS) as [string, Constant][];
  const m = terrain.meta;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Assumptions" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Assumptions</h2>
          <button className="ghost" onClick={onClose} aria-label="Close assumptions">
            Close
          </button>
        </header>
        <p className="muted">
          Every number this game uses, with its source. Results hold only under these assumptions. Three separate
          budgets appear in the game and are never mixed: the {V.CREW_LIMIT_NUCLEAR_MSV} mSv per mission year crew limit for nuclear sources,
          the {V.CAREER_LIMIT_MSV} mSv career limit for all spaceflight radiation, and natural background.
        </p>

        <h3>Dose model</h3>
        <ul className="formulas">
          <li>
            Inside the {V.SHIELD_CONE_ANGLE_DEG}° shield shadow: <code>dose = {V.DOSE_IN_CONE_REM_YR} rem/yr × (1 km / r)²</code>
          </li>
          <li>
            Outside it: <code>dose = {V.DOSE_OUT_CONE_REM_YR} rem/yr × (1 km / r)²</code>
          </li>
          <li>
            Through x cm of regolith (terrain or berm): <code>× e^(−k·x)</code>
          </li>
          <li>
            Mission dose: <code>Σ (dose rate at location × hours there)</code>, with the habitat factor applied indoors
          </li>
        </ul>

        {ORDER.map((kind) => {
          const rows = entries.filter(([, c]) => c.kind === kind);
          return (
            <section key={kind}>
              <h3>{KIND_LABEL[kind]}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, c]) => (
                    <tr key={key} data-constant={key}>
                      <td>
                        {c.label}
                        {c.note && <div className="note">{c.note}</div>}
                      </td>
                      <td className="num">
                        {fmtConst(c.value)} <span className="unit">{c.unit}</span>
                      </td>
                      <td>
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer">
                            {c.source}
                          </a>
                        ) : (
                          c.source
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}

        <h3>Terrain</h3>
        <p>
          {m.site} ({m.name}), LOLA {m.native_resolution_m} m/px elevation map, block-averaged {m.downsample_factor}× to{' '}
          {m.resolution_m} m/px ({m.width} × {m.height} cells).{' '}
          <a href={m.source_url} target="_blank" rel="noreferrer">
            Source file
          </a>
          . {m.source_citation}.
        </p>

        <h3>Known limitations</h3>
        <ul>
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
