# Shadowline — Requirements Verification Matrix

Each requirement is a testable "shall" statement with a source, a priority, a verification
method, and the evidence that closes it.

- **Method**: T = automated test (`npm test`), A = analysis, D = demonstration in the running game, I = inspection of code/docs.
- **Test IDs** (`V-xx`) are the `describe` block names in `tests/`. Run them all with `npm test`.
- **Status** reflects the run recorded in the README (94 of 94 tests passing).

## Physics

| ID | Requirement | Source | Pri | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| R-01 | The engine shall compute reactor dose rate at any map point as 5 rem/yr × (1 km/r)² inside the 36° shield cone and 50 rem/yr × (1 km/r)² outside it. | NETS 2026 (NTRS 20260002525); INL FSP webinar 2024 | Must | T | [V-02](../tests/physics.test.ts), [V-05](../tests/physics.test.ts) | Pass |
| R-02 | Dose at 1 km shall be exactly 5 rem/yr inside the cone and 50 rem/yr outside. | Same | Must | T | [V-02](../tests/physics.test.ts) | Pass |
| R-03 | Doubling distance shall reduce dose to 25% ± 0.1%. | Inverse-square law | Must | T | [V-03](../tests/physics.test.ts) | Pass |
| R-04 | The engine shall reproduce the unshielded benchmark: 26.3 rem/yr at 500 m gives a 5 rem/yr distance of 1.15 km ± 1%. | Aerospace 2025, 12(1), 58 | Must | T | [V-01](../tests/physics.test.ts) (result 1146.7 m, −0.29%) | Pass |
| R-05 | Regolith on the line of sight shall multiply dose by e^(−k·x); 100 cm at default k = 0.035 /cm shall give e^(−3.5) ± 1%. | Aerospace 2025 | Must | T | [V-04](../tests/physics.test.ts) | Pass |
| R-06 | Terrain that crosses the reactor-to-crew line of sight shall attenuate dose by its path length; terrain that does not shall have no effect. | Project brief (gap 3: flat-terrain assumption) | Must | T | [V-06](../tests/physics.test.ts) | Pass |
| R-07 | Mission dose shall equal Σ(dose rate × hours at location), with the habitat shielding factor applied indoors, scaled by mission length. | Project brief | Must | T | [V-07](../tests/physics.test.ts) | Pass |
| R-08 | Natural background (1,369 μSv/day) shall be reported separately against the 600 mSv career limit and never added to the 20 mSv reactor budget. | Chang'e 4 LND (Sci. Adv. 2020); NASA-STD-3001 | Must | T + I | [V-07](../tests/physics.test.ts); `computeExposure` returns `backgroundMsv` separately from `reactorMsv` | Pass |
| R-09 | Cable mass shall be 73 kg per km of reactor-to-habitat distance, scaled linearly. | NASA Glenn 40 kWe concept (NTRS 20220007008) | Must | T | [V-08](../tests/physics.test.ts) | Pass |
| R-10 | Every numeric constant shall live in `src/physics/constants.ts` with a source. | Project constraint | Must | T + I | [V-09](../tests/physics.test.ts); inspection of `src/` | Pass |
| R-11 | The physics engine shall have no dependency on the UI. | Project constraint | Must | I | `src/physics/` imports nothing from `src/ui/`, `src/game/`, or React | Pass |

## Terrain

| ID | Requirement | Source | Pri | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| R-12 | The game shall use one NASA PGDA LOLA 5 m/px south-pole site tile, downsampled to 20–50 m/px, and never load the polar mosaic. | Project brief | Must | T + I | [V-10](../tests/game.test.ts); `preprocess/terrain.py` refuses downloads over 200 MB | Pass |
| R-13 | The preprocessing script shall write `public/terrain/<site>.bin` and `.json` with bounds, resolution and units. | Project brief | Must | D | `python3 preprocess/terrain.py` → `site04.bin` (640 kB), `site04.json` | Pass |

## Game

| ID | Requirement | Source | Pri | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| R-14 | The game shall present two mission scenarios: a 33-day sortie and a 365-day outpost. | Challenge fit | Must | T | [V-11, V-12](../tests/game.test.ts) | Pass |
| R-15 | Level 1 with the published 1 km layout shall be within the 20 mSv limit. | NASA-STD-3001; NETS 2026 | Must | T | [V-12](../tests/game.test.ts) (5.3 mSv on real terrain) | Pass |
| R-16 | Level 2 with the same layout shall exceed the 20 mSv limit. | Project brief (gap 1) | Must | T | [V-12](../tests/game.test.ts) (59 mSv on real terrain) | Pass |
| R-17 | Level 2 shall be solvable by distance, by a regolith berm, and by keeping the EVA route inside the shield shadow. | Project brief | Must | T + D | [V-13, V-13b](../tests/game.test.ts) | Pass |
| R-18 | Any layout over 20 mSv reactor dose shall be a hard fail (no score, cannot be submitted). | Project brief | Must | T + D | [V-12](../tests/game.test.ts); Submit button disabled | Pass |
| R-19 | The score shall reward power delivered and penalize cable mass, regolith moved, and dose (ALARA). | Project brief | Must | T | [V-14](../tests/game.test.ts) | Pass |
| R-20 | The game shall explain in plain language why a layout fails, with numbers. | Challenge audience (beginner/youth) | Must | T + D | [V-15](../tests/game.test.ts) | Pass |
| R-21 | The game shall never describe a layout as "safe"; it shall say "within NASA-STD-3001 limits under these assumptions". | Project constraint | Must | T | [V-15, V-16](../tests/game.test.ts) | Pass |
| R-22 | The game title shall be "Shadowline — lunar reactor siting game" and shall not use the NASA name in the title or logo. | Space Apps naming rules | Must | I | `index.html`, panel header | Pass |

## User interface

| ID | Requirement | Source | Pri | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| R-23 | The map shall show the terrain top-down with a draggable reactor and habitat and the shield shadow drawn. | Project brief | Must | D | Browser walkthrough (README, "Demonstrations") | Pass |
| R-24 | The map shall show a live dose heatmap with a 20 mSv contour. | Project brief | Must | D | Browser walkthrough | Pass |
| R-25 | The map shall update within 2 seconds of a layout change on a laptop browser. | Project constraint | Must | D | Measured in headless Chromium: about 100 ms per drag step, about 0.5 s full-resolution refresh on release | Pass |
| R-26 | The game shall be usable at 1280 px width with no horizontal scrolling. | Project constraint | Must | D | Walkthrough at 1280 × 800: no horizontal overflow | Pass |
| R-27 | Every constant shall appear in the Assumptions drawer with its value and source. | Project constraint | Must | T | [V-16](../tests/assumptions.test.tsx) (one check per constant) | Pass |
| R-28 | The regolith coefficient k shall be adjustable by a slider labeled as a contested parameter. | Project brief (gap 2) | Must | D | "Regolith attenuation k — contested parameter" slider | Pass |
| R-29 | The build shall be static files that run with no backend. | Project constraint | Must | D | `npm run build`; `dist/index.html` opened directly from disk (`file://`) in Chromium with no console errors | Pass |

## Not yet verified (validation, needs people)

| ID | Requirement | Method | Status |
|---|---|---|---|
| R-30 | A new player shall complete Level 1 in under 5 minutes without help. | Demonstration with 1–2 outside users | Open |
| R-31 | A non-engineer shall be able to say why the Level 2 layout failed after reading the explanation. | Demonstration with 1–2 outside users | Open |
| R-32 | The simplified dose model shall be compared against a transport code (OpenMC). | Analysis | Open (next step) |
