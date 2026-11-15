import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Terrain, type TerrainMeta } from '../src/physics/terrain';

/** Loads the shipped terrain tile exactly as the app does. */
export function loadShippedTerrain(site = 'site04'): Terrain {
  const dir = resolve(__dirname, '../public/terrain');
  const meta = JSON.parse(readFileSync(resolve(dir, `${site}.json`), 'utf8')) as TerrainMeta;
  const buf = readFileSync(resolve(dir, `${site}.bin`));
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return new Terrain(data, meta);
}
