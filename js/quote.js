/*
 * Pricing engine: takes the lines produced by calculators, applies waste,
 * converts to packs, picks a supplier price and totals the quote.
 */
(function (root) {
  const GST = 0.15;
  const EPS = 1e-9;
  const money = (n) => Math.round(n * 100) / 100;

  // Choose which supplier price to use for a material.
  // Real supplier prices always beat the built-in estimate.
  function resolvePrice(material, settings) {
    const prices = material.prices || {};
    const real = Object.entries(prices).filter(([s, p]) => s !== 'est' && p != null && p !== '' && !isNaN(p));
    const pref = settings.supplier;
    if (pref && pref !== 'cheapest') {
      const hit = real.find(([s]) => s === pref);
      if (hit) return { supplier: hit[0], price: Number(hit[1]) };
    }
    if (real.length) {
      const [s, p] = real.reduce((a, b) => (Number(b[1]) < Number(a[1]) ? b : a));
      return { supplier: s, price: Number(p) };
    }
    if (prices.est != null) return { supplier: 'est', price: Number(prices.est) };
    return { supplier: null, price: 0 };
  }

  // Turn one calculator line into a priced, displayable line.
  function expandLine(line, material, settings) {
    const waste = material.waste ? (settings.wastePct || 0) / 100 : 0;
    let count;
    let need = null;
    if (line.need != null) {
      need = line.need * (1 + waste);
      count = need > 0 ? Math.ceil(need / (material.per || 1) - EPS) : 0;
    } else {
      // fractional counts (e.g. 1.4 m³ ready-mix) are kept as-is
      const raw = line.count * (1 + waste);
      count = Number.isInteger(line.count) ? Math.ceil(raw - EPS) : Math.round(raw * 100) / 100;
    }
    const qty = line.length ? count * line.length : count; // priced quantity
    const { supplier, price } = resolvePrice(material, settings);
    return {
      id: material.id,
      name: material.name,
      category: material.category,
      unit: material.unit,
      count,
      length: line.length || null,
      need: need != null ? Math.ceil(need - EPS) : null,
      of: material.of || null,
      qty,
      supplier,
      unitPrice: price,
      cost: money(qty * price),
      note: line.note || '',
    };
  }

  function describeQty(l) {
    if (l.length) return `${l.count} × ${l.length} m`;
    const plural = { box: 'boxes', each: '', m: 'm', m3: 'm³' };
    const u = l.count === 1 ? (l.unit === 'each' ? '' : l.unit.replace('m3', 'm³')) : (l.unit in plural ? plural[l.unit] : l.unit + 's');
    const base = u ? `${l.count} ${u}` : String(l.count);
    return l.need != null ? `${base} (${l.need} ${l.of})` : base;
  }

  // Price one build (e.g. "fence") from the calculator output.
  function priceBuild(build, calculators, catalogue, settings) {
    const calc = calculators[build.type];
    const out = calc ? calc.compute(build.inputs) : { lines: [], notes: [] };
    const lines = [];
    for (const raw of out.lines.concat(build.extras || [])) {
      const m = catalogue[raw.id];
      if (!m) continue;
      const l = expandLine(raw, m, settings);
      if (l.count > 0) lines.push(l);
    }
    const materials = money(lines.reduce((a, l) => a + l.cost, 0));
    const labour = money((Number(build.hours) || 0) * (Number(settings.labourRate) || 0));
    return { id: build.id, type: build.type, name: build.label || (calc ? calc.name : build.type), lines, notes: out.notes || [], materials, labour };
  }

  // Merge identical lines across builds (same material and cut length).
  function mergeLines(builds) {
    const map = new Map();
    for (const b of builds) {
      for (const l of b.lines) {
        const key = `${l.id}|${l.length || ''}`;
        const cur = map.get(key);
        if (cur) {
          cur.count += l.count;
          cur.qty += l.qty;
          cur.cost = money(cur.cost + l.cost);
          if (cur.need != null && l.need != null) cur.need += l.need;
        } else {
          map.set(key, Object.assign({}, l, { note: '' }));
        }
      }
    }
    return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  /*
   * Catalogue prices include GST. If GST-registered, materials are costed
   * ex-GST (the GST is claimed back) and GST is added to the final quote.
   * If not registered, the GST-inclusive cost is the real cost and no GST is added.
   */
  function totalQuote(job, calculators, catalogue, settings) {
    const builds = (job.builds || []).map((b) => priceBuild(b, calculators, catalogue, settings));
    const lines = mergeLines(builds);
    const materialsIncl = money(builds.reduce((a, b) => a + b.materials, 0));
    const materialsCost = settings.gstRegistered ? money(materialsIncl / (1 + GST)) : materialsIncl;
    const markup = money(materialsCost * (Number(settings.markupPct) || 0) / 100);
    const labour = money(builds.reduce((a, b) => a + b.labour, 0));
    const extra = money(Number(job.extraCost) || 0);
    const subtotal = money(materialsCost + markup + labour + extra);
    const gst = settings.gstRegistered ? money(subtotal * GST) : 0;
    return { builds, lines, materialsIncl, materialsCost, markup, labour, extra, subtotal, gst, total: money(subtotal + gst) };
  }

  const api = { GST, resolvePrice, expandLine, describeQty, priceBuild, mergeLines, totalQuote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SQ_QUOTE = api;
})(this);
