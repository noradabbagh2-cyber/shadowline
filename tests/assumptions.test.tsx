/**
 * Verification suite — traceability of on-screen numbers.
 * V-16: the Assumptions drawer lists every constant in the registry with its value and source.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONSTANTS } from '../src/physics/constants';
import { AssumptionsDrawer } from '../src/ui/AssumptionsDrawer';
import { fmtConst } from '../src/ui/format';
import { loadShippedTerrain } from './helpers';

const decode = (html: string) =>
  html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('V-16 Assumptions drawer', () => {
  const html = decode(renderToStaticMarkup(<AssumptionsDrawer terrain={loadShippedTerrain()} onClose={() => {}} />));
  it('has one row per constant in the registry', () => {
    const rows = html.match(/data-constant="/g) ?? [];
    expect(rows.length).toBe(Object.keys(CONSTANTS).length);
  });
  it.each(Object.entries(CONSTANTS))('%s is listed with its value and source', (key, c) => {
    expect(html).toContain(`data-constant="${key}"`);
    expect(html).toContain(c.label);
    expect(html).toContain(`>${fmtConst(c.value)} <`);
    expect(html).toContain(c.source);
  });
  it('lists the terrain source and the known limitations', () => {
    expect(html).toContain('pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/');
    expect(html).toMatch(/No neutron scatter or skyshine/);
    expect(html).toMatch(/OpenMC/);
    expect(html).not.toMatch(/\bsafe\b/i);
  });
});
