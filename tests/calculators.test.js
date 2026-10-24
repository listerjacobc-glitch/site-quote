const test = require('node:test');
const assert = require('node:assert');
const { CALCULATORS, stockLength, piecesForRun, paintTins } = require('../js/calculators.js');
const { MATERIALS } = require('../js/materials.js');
const Q = require('../js/quote.js');

const catalogue = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));
const settings = { supplier: 'cheapest', wastePct: 0, markupPct: 0, labourRate: 0, gstRegistered: false };
const defaults = (type, o) => Object.assign(Object.fromEntries(CALCULATORS[type].fields.map((f) => [f.key, f.default])), o);
const byId = (lines, id) => lines.filter((l) => l.id === id);

test('stock lengths round up', () => {
  assert.strictEqual(stockLength(1.75), 1.8);
  assert.strictEqual(stockLength(2.4), 2.4);
  assert.strictEqual(stockLength(2.41), 2.7);
  assert.deepStrictEqual(piecesForRun(10), { count: 2, length: 5.4 });
  assert.deepStrictEqual(piecesForRun(4.8), { count: 1, length: 4.8 });
});

test('paint tins prefer a 10L over three 4L', () => {
  assert.deepStrictEqual(paintTins(9), { ten: 1, four: 0 });
  assert.deepStrictEqual(paintTins(13), { ten: 1, four: 1 });
  assert.deepStrictEqual(paintTins(3), { ten: 0, four: 1 });
});

test('10 m x 1.8 m paling fence', () => {
  const { lines } = CALCULATORS.fence.compute(defaults('fence', { length: 10, height: 1.8 }));
  const posts = byId(lines, 'post_100_h4')[0];
  assert.strictEqual(posts.count, 6); // 5 bays
  assert.strictEqual(posts.length, 2.4); // 1.8 + 0.6 in ground
  assert.strictEqual(byId(lines, 'rail_100x50_h32')[0].count, 6); // 3 rails x 2 pieces
  const palings = byId(lines, 'paling_150x25_h32')[0];
  assert.strictEqual(palings.count, 67);
  assert.strictEqual(palings.length, 1.8);
  assert.strictEqual(byId(lines, 'postmix_20')[0].count, 18);
});

test('gates add hardware and a post', () => {
  const { lines } = CALCULATORS.fence.compute(defaults('fence', { length: 10, gates: 1 }));
  assert.strictEqual(byId(lines, 'post_100_h4')[0].count, 7);
  assert.strictEqual(byId(lines, 'gate_hinge')[0].count, 1);
});

test('pack conversion: nails needed become boxes', () => {
  const l = Q.expandLine({ id: 'nail_paling_60', need: 402 }, catalogue.nail_paling_60, settings);
  assert.strictEqual(l.count, 2); // 300 per box
  assert.strictEqual(l.need, 402);
});

test('waste applies to timber only', () => {
  const s = Object.assign({}, settings, { wastePct: 10 });
  assert.strictEqual(Q.expandLine({ id: 'paling_150x25_h32', count: 67, length: 1.8 }, catalogue.paling_150x25_h32, s).count, 74);
  assert.strictEqual(Q.expandLine({ id: 'post_100_h4', count: 6, length: 2.4 }, catalogue.post_100_h4, s).count, 6);
});

test('real supplier price beats estimate; preferred supplier wins', () => {
  const m = { prices: { est: 10, bunnings: 12, placemakers: 11 } };
  assert.deepStrictEqual(Q.resolvePrice(m, { supplier: 'cheapest' }), { supplier: 'placemakers', price: 11 });
  assert.deepStrictEqual(Q.resolvePrice(m, { supplier: 'bunnings' }), { supplier: 'bunnings', price: 12 });
  assert.deepStrictEqual(Q.resolvePrice(m, { supplier: 'carters' }), { supplier: 'placemakers', price: 11 });
  assert.deepStrictEqual(Q.resolvePrice({ prices: { est: 10 } }, { supplier: 'cheapest' }), { supplier: 'est', price: 10 });
});

test('GST handling', () => {
  const job = { builds: [{ id: 'a', type: 'paint', inputs: defaults('paint'), hours: 2 }] };
  const reg = Q.totalQuote(job, CALCULATORS, catalogue, { supplier: 'cheapest', wastePct: 0, markupPct: 10, labourRate: 50, gstRegistered: true });
  assert.ok(Math.abs(reg.materialsCost - reg.materialsIncl / 1.15) < 0.01);
  assert.strictEqual(reg.labour, 100);
  assert.ok(Math.abs(reg.total - reg.subtotal * 1.15) < 0.01);
  const unreg = Q.totalQuote(job, CALCULATORS, catalogue, { supplier: 'cheapest', wastePct: 0, markupPct: 0, labourRate: 50, gstRegistered: false });
  assert.strictEqual(unreg.gst, 0);
  assert.strictEqual(unreg.materialsCost, unreg.materialsIncl);
});

test('every calculator produces only known materials with sane numbers', () => {
  for (const [type, calc] of Object.entries(CALCULATORS)) {
    const { lines } = calc.compute(defaults(type));
    assert.ok(lines.length > 0, type);
    for (const l of lines) {
      assert.ok(catalogue[l.id], `${type}: unknown material ${l.id}`);
      const n = l.need != null ? l.need : l.count;
      assert.ok(Number.isFinite(n) && n >= 0, `${type}: bad qty for ${l.id}`);
    }
  }
});

test('slab switches to ready-mix for bigger pours', () => {
  const small = CALCULATORS.slab.compute(defaults('slab', { length: 2, width: 1 })).lines;
  assert.ok(byId(small, 'concrete_20').length);
  const big = CALCULATORS.slab.compute(defaults('slab', { length: 6, width: 4 })).lines;
  assert.strictEqual(byId(big, 'readymix_m3')[0].count, 2.6);
});
