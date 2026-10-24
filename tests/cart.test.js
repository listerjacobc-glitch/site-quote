const test = require('node:test');
const assert = require('node:assert');
const { CALCULATORS } = require('../js/calculators.js');
const { MATERIALS } = require('../js/materials.js');
const Q = require('../js/quote.js');
const CART = require('../js/cart.js');

const catalogue = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));
const settings = { supplier: 'cheapest', wastePct: 10, markupPct: 0, labourRate: 0, gstRegistered: true };
const inputs = Object.fromEntries(CALCULATORS.fence.fields.map((f) => [f.key, f.default]));
const lines = Q.totalQuote({ builds: [{ id: 'a', type: 'fence', inputs, hours: 0 }] }, CALCULATORS, catalogue, settings).lines;

test('instructions list every line with id, quantity and search term', () => {
  const text = CART.cartInstructions(lines, { client: 'Test', address: 'Lower Hutt' });
  assert.match(text, /Mitre 10 MEGA Lower Hutt/);
  assert.match(text, /Do not check out/);
  for (const l of lines) assert.ok(text.includes(`[${l.id}]`), l.id);
  assert.match(text, /74 lengths at 1\.8 m \(133\.2 m total\)/);
  assert.match(text, /Search for: 150x25 H3\.2 rough sawn paling 1\.8m/);
  assert.match(text, /id,mitre10/);
});

test('pack items ask Claude to cover the real need', () => {
  const nails = lines.find((l) => l.id === 'nail_paling_60');
  assert.match(CART.buyText(nails), /^2 boxes\. I need about 402 nails/);
});

test('search term drops pack-size notes', () => {
  assert.strictEqual(CART.searchTerm({ name: 'Decking screws 10g x 65 stainless (box 500)' }), 'Decking screws 10g x 65 stainless');
});

test('cuts of the same timber become one cart item, short cuts come off longer lengths', () => {
  const gated = Object.assign({}, inputs, { gates: 1 });
  const ls = Q.totalQuote({ builds: [{ id: 'a', type: 'fence', inputs: gated, hours: 0 }] }, CALCULATORS, catalogue, settings).lines;
  const text = CART.cartInstructions(ls, {});
  assert.strictEqual(text.split('[rail_100x50_h32]').length - 1, 1);
  assert.match(text, /short cuts .* buy extra lengths to cut these from/);
  assert.doesNotMatch(text, /lengths? at 0\.9 m/);
});
