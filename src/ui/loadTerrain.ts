import { Terrain, type TerrainMeta } from '../physics/terrain';
// The preprocessed tile is embedded in the bundle so the built game also runs from file://.
import binDataUrl from '../../public/terrain/site04.bin?inline';
import meta from '../../public/terrain/site04.json';

export async function loadTerrain(): Promise<Terrain> {
  const buf = await (await fetch(binDataUrl)).arrayBuffer();
  return new Terrain(new Float32Array(buf), meta as unknown as TerrainMeta);
}
