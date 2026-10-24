/* Site Quote UI. Everything is stored on this device (localStorage). */
(function () {
  const { SUPPLIERS, MATERIALS } = window.SQ_DATA;
  const { CALCULATORS } = window.SQ_CALC;
  const Q = window.SQ_QUOTE;
  const STORE_KEY = 'sitequote.v1';
  const FT = 0.3048;

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const nzd = (n) => '$' + (Number(n) || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const supplierName = (id) => (SUPPLIERS.find((s) => s.id === id) || { name: id || '—' }).name;
  const today = () => new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  const DEFAULT_SETTINGS = {
    business: '', phone: '', supplier: 'cheapest', wastePct: 10, markupPct: 15,
    labourRate: 65, gstRegistered: true, units: 'm',
  };

  // ---------- state ----------
  let state = load();
  let view = 'quote';

  function newJob() {
    return { id: uid(), client: '', address: '', notes: '', created: Date.now(), builds: [], extraCost: 0, extraLabel: '' };
  }

  function sampleJob() {
    const job = newJob();
    job.client = 'Example: 14 Kauri St';
    job.address = 'Waterloo, Lower Hutt';
    job.notes = 'Sample job - replace with your own. Back boundary fence with one side gate.';
    job.builds.push(makeBuild('fence', { length: 12, gates: 1 }, 10));
    return job;
  }

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* storage blocked */ }
    s = s || {};
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS, s.settings),
      prices: s.prices || {},          // { materialId: { supplierId: price } }
      custom: s.custom || [],          // user-added materials
      job: s.job || sampleJob(),
      saved: s.saved || [],
      welcomed: !!s.welcomed,
      feedback: s.feedback || {},
    };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }

  function catalogue() {
    const out = {};
    for (const m of MATERIALS.concat(state.custom)) {
      out[m.id] = Object.assign({}, m, { prices: Object.assign({}, m.prices, state.prices[m.id]) });
    }
    return out;
  }

  function makeBuild(type, overrides, hours) {
    const inputs = {};
    for (const f of CALCULATORS[type].fields) inputs[f.key] = f.default;
    return { id: uid(), type, inputs: Object.assign(inputs, overrides), hours: hours || 0, label: '', extras: [] };
  }

  function computeQuote() {
    return Q.totalQuote(state.job, CALCULATORS, catalogue(), state.settings);
  }

  // ---------- units ----------
  const isFt = () => state.settings.units === 'ft';
  const toDisplay = (m) => +(isFt() ? m / FT : m).toFixed(2);
  const fromDisplay = (v) => (isFt() ? v * FT : v);
  const lenUnit = () => (isFt() ? 'ft' : 'm');

  function buildSummary(b) {
    const i = b.inputs;
    const L = (v) => `${toDisplay(v)} ${lenUnit()}`;
    switch (b.type) {
      case 'fence': return `${L(i.length)} long x ${L(i.height)} high` + (i.gates ? `, ${i.gates} gate${i.gates > 1 ? 's' : ''}` : '');
      case 'deck': return `${L(i.length)} x ${L(i.width)}, ${L(i.height)} high`;
      case 'wall': return `${L(i.length)} long x ${L(i.height)} high`;
      case 'paint': return `${L(i.length)} x ${L(i.width)} room, ${i.coats} coats`;
      case 'slab': return `${L(i.length)} x ${L(i.width)} x ${i.thickness}mm`;
      default: return '';
    }
  }

  // ---------- rendering ----------
  function render() {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    const app = $('#app');
    if (view === 'quote') app.innerHTML = quoteView();
    else if (view === 'prices') app.innerHTML = pricesView();
    else if (view === 'saved') app.innerHTML = savedView();
    else if (view === 'settings') app.innerHTML = settingsView();
    else app.innerHTML = helpView();
    if (view === 'quote') refreshResults();
  }

  function fieldHtml(b, f) {
    const id = `f-${b.id}-${f.key}`;
    const v = b.inputs[f.key];
    if (f.type === 'checkbox') {
      return `<div class="field"><span class="lbl">&nbsp;</span><label class="check" for="${id}">
        <input type="checkbox" id="${id}" data-build="${b.id}" data-key="${f.key}" ${v ? 'checked' : ''}>${esc(f.label)}</label></div>`;
    }
    if (f.type === 'select') {
      const opts = f.options.map(([val, txt]) => `<option value="${esc(val)}" ${String(v) === val ? 'selected' : ''}>${esc(txt)}</option>`).join('');
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" data-build="${b.id}" data-key="${f.key}">${opts}</select></div>`;
    }
    const isLen = f.type === 'length';
    const shown = isLen ? toDisplay(v) : v;
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>
      <div class="unit-wrap"><input type="number" inputmode="decimal" step="any" min="0" id="${id}" value="${esc(shown)}"
        data-build="${b.id}" data-key="${f.key}" data-len="${isLen ? 1 : ''}">${isLen ? `<span>${lenUnit()}</span>` : ''}</div></div>`;
  }

  function buildCard(b) {
    const calc = CALCULATORS[b.type];
    const cat = catalogue();
    const opts = Object.values(cat).sort((a, c) => a.name.localeCompare(c.name))
      .map((m) => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.unit)})</option>`).join('');
    const extras = (b.extras || []).map((x, n) => {
      const m = cat[x.id];
      return `<li>${esc(x.count)} ${esc(m ? m.unit : '')} ${esc(m ? m.name : x.id)}
        <button class="btn ghost sm" data-act="rm-extra" data-build="${b.id}" data-n="${n}" aria-label="Remove">Remove</button></li>`;
    }).join('');
    return `<section class="panel" id="build-${b.id}">
      <div class="panel-head">
        <h3>${esc(b.label || calc.name)}</h3>
        <button class="btn ghost sm danger no-print" data-act="rm-build" data-build="${b.id}">Remove</button>
      </div>
      <div class="fields no-print">
        ${calc.fields.map((f) => fieldHtml(b, f)).join('')}
        <div class="field"><label for="h-${b.id}">Labour hours</label>
          <input type="number" inputmode="decimal" step="any" min="0" id="h-${b.id}" value="${esc(b.hours)}" data-build="${b.id}" data-key="__hours"></div>
        <div class="field"><label for="l-${b.id}">Label on quote</label>
          <input type="text" id="l-${b.id}" value="${esc(b.label)}" placeholder="${esc(calc.name)}" data-build="${b.id}" data-key="__label"></div>
      </div>
      <div class="results" data-results="${b.id}"></div>
      <details class="no-print">
        <summary class="small muted">Add another material to this build</summary>
        <div class="fields" style="margin-top:10px">
          <div class="field wide"><label for="xm-${b.id}">Material</label><select id="xm-${b.id}">${opts}</select></div>
          <div class="field"><label for="xc-${b.id}">Quantity</label><input type="number" inputmode="decimal" step="any" min="0" id="xc-${b.id}" value="1"></div>
          <div class="field"><span class="lbl">&nbsp;</span><button class="btn" data-act="add-extra" data-build="${b.id}">Add</button></div>
        </div>
        ${extras ? `<ul class="small">${extras}</ul>` : ''}
      </details>
    </section>`;
  }

  function linesTable(lines, withCats) {
    if (!lines.length) return '<p class="muted small">No materials yet - enter some measurements.</p>';
    let lastCat = null;
    const rows = lines.map((l) => {
      let cat = '';
      if (withCats && l.category !== lastCat) { lastCat = l.category; cat = `<tr class="cat"><td colspan="3">${esc(l.category)}</td></tr>`; }
      const unitDesc = l.length || l.unit === 'm' ? `${nzd(l.unitPrice)}/m` : `${nzd(l.unitPrice)} ea`;
      return `${cat}<tr>
        <td class="qty">${esc(Q.describeQty(l))}</td>
        <td>${esc(l.name)}${l.note ? `<span class="sub">${esc(l.note)}</span>` : ''}
          <span class="supplier ${l.supplier === 'est' ? 'est' : ''}">${esc(supplierName(l.supplier))} · ${unitDesc}</span></td>
        <td class="num">${nzd(l.cost)}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><thead><tr><th>Qty</th><th>Material</th><th class="num">Cost</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function quoteView() {
    const j = state.job;
    const adds = Object.entries(CALCULATORS).map(([k, c]) => `<button class="btn" data-act="add-build" data-type="${k}">+ ${esc(c.name)}</button>`).join('');
    const welcome = state.welcomed ? '' : `<section class="panel welcome no-print">
          <div class="panel-head"><h3>Welcome to Site Quote</h3>
            <button class="btn ghost sm" data-act="dismiss-welcome">Hide</button></div>
          <p class="small" style="margin:0">This is a test version. The job below is an example. Change the measurements and watch the materials list and total update.
          When you've had a play, open <strong>Help</strong> to send your feedback.</p>
          <div class="btn-row"><button class="btn sm primary" data-act="go-help">How it works</button></div>
        </section>`;
    return `<div class="layout">
      <div class="stack">
        ${welcome}
        <div class="print-only">
          <h2>${esc(state.settings.business || 'Quote')}</h2>
          <p>${esc(state.settings.phone)}<br>Quote date: ${today()}</p>
        </div>
        <section class="panel">
          <div class="panel-head"><h2>Job</h2>
            <button class="btn ghost sm no-print" data-act="new-job">New job</button></div>
          <div class="fields">
            <div class="field"><label for="j-client">Client</label><input type="text" id="j-client" data-job="client" value="${esc(j.client)}" placeholder="Name"></div>
            <div class="field"><label for="j-address">Site address</label><input type="text" id="j-address" data-job="address" value="${esc(j.address)}" placeholder="Street, suburb"></div>
            <div class="field wide"><label for="j-notes">Site notes</label><textarea id="j-notes" data-job="notes" placeholder="Access, ground conditions, what the client wants...">${esc(j.notes)}</textarea></div>
          </div>
        </section>
        ${j.builds.map(buildCard).join('')}
        <section class="panel no-print">
          <h3>Add a build</h3>
          <div class="add-builds">${adds}</div>
          <p class="small muted">Measurements in ${isFt() ? 'feet' : 'metres'} (change in Settings). Add several builds to one job, e.g. a fence plus a gate and a path.</p>
        </section>
      </div>
      <aside class="rail"><section class="panel" id="summary"></section></aside>
      <section class="panel shopping" id="shopping"></section>
    </div>`;
  }

  function refreshResults() {
    const q = computeQuote();
    for (const b of q.builds) {
      const el = document.querySelector(`[data-results="${b.id}"]`);
      if (!el) continue;
      const notes = b.notes.length ? `<ul class="notes">${b.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
      el.innerHTML = `${linesTable(b.lines)}${notes}
        <div class="totals small"><div class="row"><span>Materials (incl. GST)</span><strong>${nzd(b.materials)}</strong></div>
        ${b.labour ? `<div class="row"><span>Labour</span><strong>${nzd(b.labour)}</strong></div>` : ''}</div>`;
    }
    const s = state.settings;
    const usesEst = q.lines.some((l) => l.supplier === 'est');
    $('#summary').innerHTML = `
      <div class="eyebrow">Quote total</div>
      <div class="totals">
        <div class="row"><span>Materials${s.gstRegistered ? ' (ex GST)' : ''}</span><span>${nzd(q.materialsCost)}</span></div>
        <div class="row"><span>Margin on materials (${esc(s.markupPct)}%)</span><span>${nzd(q.markup)}</span></div>
        <div class="row"><span>Labour (${q.builds.reduce((a, b) => a + (Number(state.job.builds.find((x) => x.id === b.id).hours) || 0), 0)} h @ ${nzd(s.labourRate)})</span><span>${nzd(q.labour)}</span></div>
        <div class="row no-print"><label for="j-extra" class="small muted">Other costs (skip bin, hire...)</label></div>
        <div class="row no-print"><input type="number" inputmode="decimal" step="any" min="0" id="j-extra" data-job="extraCost" value="${esc(state.job.extraCost || 0)}"></div>
        ${q.extra ? `<div class="row"><span>Other costs</span><span>${nzd(q.extra)}</span></div>` : ''}
        <div class="row"><span>Subtotal</span><span>${nzd(q.subtotal)}</span></div>
        ${s.gstRegistered ? `<div class="row"><span>GST 15%</span><span>${nzd(q.gst)}</span></div>` : ''}
        <div class="row grand"><span>Total</span><span>${nzd(q.total)}</span></div>
      </div>
      ${usesEst ? `<p class="small" style="color:var(--est);margin:0">Some prices are built-in estimates. Check them on the Prices tab before sending.</p>` : ''}
      <div class="btn-row">
        <button class="btn primary" data-act="save-job">Save job</button>
        <button class="btn" data-act="copy-quote">Copy quote</button>
        <button class="btn" data-act="copy-list">Copy shopping list</button>
        <button class="btn" data-act="print">Print / PDF</button>
      </div>`;
    const bySupplier = {};
    for (const l of q.lines) (bySupplier[l.supplier] = bySupplier[l.supplier] || []).push(l);
    $('#shopping').innerHTML = `<h3>Shopping list</h3>
      <p class="small muted">All builds combined, grouped by where the price came from.</p>
      ${Object.entries(bySupplier).map(([sup, ls]) => `<div><div class="eyebrow">${esc(supplierName(sup))} · ${nzd(ls.reduce((a, l) => a + l.cost, 0))}</div>${linesTable(ls, true)}</div>`).join('') || '<p class="muted small">Add a build to see the list.</p>'}`;
  }

  function quoteText() {
    const q = computeQuote();
    const s = state.settings;
    const j = state.job;
    const out = [];
    out.push(`QUOTE${s.business ? ' - ' + s.business : ''}`);
    if (s.phone) out.push(s.phone);
    out.push(`Date: ${today()}`);
    if (j.client) out.push(`Client: ${j.client}`);
    if (j.address) out.push(`Site: ${j.address}`);
    out.push('');
    for (const b of q.builds) {
      const src = j.builds.find((x) => x.id === b.id);
      out.push(`${b.name} (${buildSummary(src)})`);
      for (const l of b.lines) out.push(`  ${Q.describeQty(l)}  ${l.name}  ${nzd(l.cost)}`);
      out.push('');
    }
    out.push(`Materials${s.gstRegistered ? ' (ex GST)' : ''}: ${nzd(q.materialsCost + q.markup)}`);
    if (q.labour) out.push(`Labour: ${nzd(q.labour)}`);
    if (q.extra) out.push(`Other costs: ${nzd(q.extra)}`);
    if (s.gstRegistered) { out.push(`Subtotal: ${nzd(q.subtotal)}`); out.push(`GST 15%: ${nzd(q.gst)}`); }
    out.push(`TOTAL: ${nzd(q.total)}${s.gstRegistered ? ' incl GST' : ''}`);
    out.push('', 'Quote valid for 30 days. Material prices subject to supplier changes.');
    return out.join('\n');
  }

  function shoppingText() {
    const q = computeQuote();
    const groups = {};
    for (const l of q.lines) (groups[l.supplier] = groups[l.supplier] || []).push(l);
    const out = [`Shopping list - ${state.job.client || 'job'} (${today()})`];
    for (const [sup, ls] of Object.entries(groups)) {
      out.push('', supplierName(sup).toUpperCase());
      for (const l of ls) out.push(`[ ] ${Q.describeQty(l)}  ${l.name}`);
    }
    return out.join('\n');
  }

  function pricesView() {
    const cat = catalogue();
    const real = SUPPLIERS.filter((s) => s.id !== 'est');
    const byCat = {};
    for (const m of Object.values(cat)) (byCat[m.category] = byCat[m.category] || []).push(m);
    const rows = Object.entries(byCat).map(([c, ms]) => `<tr class="cat"><td colspan="${real.length + 3}">${esc(c)}</td></tr>` +
      ms.map((m) => `<tr data-name="${esc(m.name.toLowerCase())}">
        <td class="name">${esc(m.name)}<span class="sub">per ${esc(m.unit)}${m.per ? ` · ${m.per} ${esc(m.of)}` : ''}</span></td>
        <td class="num"><span class="supplier est">${m.prices.est != null ? nzd(m.prices.est) : '—'}</span></td>
        ${real.map((s) => `<td><input type="number" inputmode="decimal" step="any" min="0" aria-label="${esc(m.name)} at ${esc(s.name)}"
          id="p-${esc(m.id)}-${s.id}" data-price="${esc(m.id)}" data-sup="${s.id}" value="${m.prices[s.id] != null ? esc(m.prices[s.id]) : ''}"></td>`).join('')}
      </tr>`).join('')).join('');
    return `<div class="stack">
      <section class="panel">
        <h2>Supplier prices</h2>
        <p class="small muted">Prices are NZD including GST, as shown on the shelf or website. Enter what you pay at each yard. The app uses your preferred supplier (Settings) or the cheapest price entered, and falls back to the built-in estimate only when a material has no price at all.</p>
        <div class="fields">
          <div class="field wide"><label for="price-search">Find a material</label><input type="search" id="price-search" placeholder="e.g. paling, GIB, 140x45"></div>
        </div>
        <div class="table-wrap"><table class="price-grid"><thead><tr><th>Material</th><th class="num">Estimate</th>
          ${real.map((s) => `<th>${esc(s.name.replace(' Lower Hutt', ''))}</th>`).join('')}</tr></thead><tbody id="price-rows">${rows}</tbody></table></div>
      </section>
      <section class="panel">
        <h3>Add your own material</h3>
        <div class="fields">
          <div class="field wide"><label for="cm-name">Name</label><input type="text" id="cm-name" placeholder="e.g. 200x50 H3.2 SG8"></div>
          <div class="field"><label for="cm-cat">Category</label><input type="text" id="cm-cat" value="Other"></div>
          <div class="field"><label for="cm-unit">Sold per</label><select id="cm-unit">${['each', 'm', 'box', 'bag', 'sheet', 'tin', 'roll', 'pack', 'm3'].map((u) => `<option>${u}</option>`).join('')}</select></div>
          <div class="field"><label for="cm-price">Price incl GST</label><input type="number" inputmode="decimal" step="any" min="0" id="cm-price"></div>
          <div class="field"><span class="lbl">&nbsp;</span><button class="btn primary" data-act="add-material">Add material</button></div>
        </div>
      </section>
      <section class="panel">
        <h3>Import / export price list</h3>
        <p class="small muted">Export to a spreadsheet, update prices from a supplier price list, then paste the CSV back in. Columns: id, name, category, unit, ${real.map((s) => s.id).join(', ')}.</p>
        <div class="btn-row"><button class="btn" data-act="export-csv">Copy CSV</button>
          <label class="btn" for="csv-file">Import CSV file</label><input type="file" id="csv-file" accept=".csv,text/csv" hidden>
          <button class="btn ghost danger" data-act="reset-prices">Clear my prices</button></div>
        <div class="field"><label for="csv-text">Or paste CSV here</label><textarea id="csv-text" placeholder="id,name,category,unit,bunnings,mitre10,..."></textarea></div>
        <div class="btn-row"><button class="btn" data-act="import-csv">Import pasted CSV</button></div>
      </section>
    </div>`;
  }

  function savedView() {
    const items = state.saved.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).map((j) => {
      const q = Q.totalQuote(j, CALCULATORS, catalogue(), state.settings);
      return `<div class="job-item">
        <div class="info"><strong>${esc(j.client || 'Untitled job')}</strong><div class="small muted">${esc(j.address)} · ${j.builds.length} build${j.builds.length === 1 ? '' : 's'} · saved ${new Date(j.updated || j.created).toLocaleDateString('en-NZ')}</div></div>
        <div class="amt">${nzd(q.total)}</div>
        <div class="btn-row"><button class="btn sm primary" data-act="open-job" data-id="${j.id}">Open</button>
          <button class="btn sm" data-act="copy-job" data-id="${j.id}">Duplicate</button>
          <button class="btn sm ghost danger" data-act="del-job" data-id="${j.id}">Delete</button></div>
      </div>`;
    }).join('');
    return `<div class="stack"><h2>Saved jobs</h2>
      <p class="small muted">Totals are recalculated with today's prices.</p>
      <div class="job-list">${items || '<div class="empty">No saved jobs yet. Build a quote and tap <strong>Save job</strong>.</div>'}</div></div>`;
  }

  function settingsView() {
    const s = state.settings;
    const sup = [['cheapest', 'Cheapest price entered']].concat(SUPPLIERS.filter((x) => x.id !== 'est').map((x) => [x.id, x.name]));
    return `<div class="stack"><section class="panel">
      <h2>Settings</h2>
      <div class="fields">
        <div class="field"><label for="s-business">Business name</label><input type="text" id="s-business" data-set="business" value="${esc(s.business)}"></div>
        <div class="field"><label for="s-phone">Phone / email on quotes</label><input type="text" id="s-phone" data-set="phone" value="${esc(s.phone)}"></div>
        <div class="field"><label for="s-supplier">Preferred supplier</label><select id="s-supplier" data-set="supplier">${sup.map(([v, t]) => `<option value="${v}" ${s.supplier === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label for="s-units">Measure in</label><select id="s-units" data-set="units"><option value="m" ${s.units === 'm' ? 'selected' : ''}>Metres</option><option value="ft" ${s.units === 'ft' ? 'selected' : ''}>Feet</option></select></div>
        <div class="field"><label for="s-waste">Waste allowance %</label><input type="number" inputmode="decimal" id="s-waste" data-set="wastePct" value="${esc(s.wastePct)}"></div>
        <div class="field"><label for="s-markup">Margin on materials %</label><input type="number" inputmode="decimal" id="s-markup" data-set="markupPct" value="${esc(s.markupPct)}"></div>
        <div class="field"><label for="s-rate">Labour rate $/h (ex GST)</label><input type="number" inputmode="decimal" id="s-rate" data-set="labourRate" value="${esc(s.labourRate)}"></div>
        <div class="field"><span class="lbl">&nbsp;</span><label class="check" for="s-gst"><input type="checkbox" id="s-gst" data-set="gstRegistered" ${s.gstRegistered ? 'checked' : ''}>GST registered</label></div>
      </div>
      <p class="small muted">Waste is added to timber, boards and sheets only. If GST registered, material costs are taken ex GST and 15% GST is added to the whole quote.</p>
    </section></div>`;
  }


  const FEEDBACK_QS = [
    ['jobs', 'What jobs do you quote most? Which ones are missing from the app?'],
    ['wrong', 'Did any quantities look wrong? Which build, and what would you have ordered?'],
    ['prices', 'Which yard do you buy from, and did any prices look way off?'],
    ['easy', 'Was anything confusing or hard to use on site?'],
    ['other', 'Anything else?'],
  ];

  function helpView() {
    const fb = state.feedback;
    return `<div class="stack">
      <section class="panel">
        <h2>How it works</h2>
        <ol class="steps">
          <li><strong>Start a job.</strong> On the Quote tab, fill in the client and site address. <em>New job</em> clears the example.</li>
          <li><strong>Add builds.</strong> Tap a build (fence, deck, wall, paint, slab) and enter the measurements from site. You can add several builds to one job.</li>
          <li><strong>Check the materials.</strong> Each build lists what to buy, with cut lengths and pack sizes. Tap <em>Add another material</em> for anything missing.</li>
          <li><strong>Add labour.</strong> Enter labour hours on each build. Set your hourly rate, margin and GST in Settings.</li>
          <li><strong>Send it.</strong> <em>Copy quote</em> gives you text to paste into a message or email. <em>Copy shopping list</em> gives a tick list for the yard.</li>
          <li><strong>Fix the prices.</strong> Prices in amber are rough estimates. On the Prices tab, type in what you actually pay at each yard and the app uses those instead.</li>
        </ol>
        <p class="small muted" style="margin:0">Your jobs and prices are saved on this phone only. Measure in feet? Switch to feet in Settings.</p>
      </section>
      <section class="panel">
        <h2>Send feedback</h2>
        <p class="small muted" style="margin:0">Answer what you can, then tap <em>Copy feedback</em> and paste it into a text or email. It includes the job you're working on so we can see what you entered.</p>
        <div class="fields">
          ${FEEDBACK_QS.map(([k, q]) => `<div class="field wide"><label for="fb-${k}">${esc(q)}</label>
            <textarea id="fb-${k}" data-fb="${k}">${esc(fb[k] || '')}</textarea></div>`).join('')}
        </div>
        <div class="btn-row"><button class="btn primary" data-act="copy-feedback">Copy feedback</button></div>
      </section>
    </div>`;
  }

  function feedbackText() {
    const out = ['SITE QUOTE FEEDBACK', ''];
    for (const [k, q] of FEEDBACK_QS) if ((state.feedback[k] || '').trim()) out.push(q, state.feedback[k].trim(), '');
    const j = state.job;
    out.push('--- Job I was testing ---');
    for (const b of j.builds) out.push(`${CALCULATORS[b.type].name}: ${buildSummary(b)}, ${b.hours || 0} h`);
    out.push('', quoteText());
    return out.join('\n');
  }

  // ---------- CSV ----------
  function toCsv() {
    const real = SUPPLIERS.filter((s) => s.id !== 'est').map((s) => s.id);
    const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v == null ? '' : v));
    const rows = [['id', 'name', 'category', 'unit', 'est'].concat(real)];
    for (const m of Object.values(catalogue())) rows.push([m.id, m.name, m.category, m.unit, m.prices.est].concat(real.map((s) => m.prices[s])));
    return rows.map((r) => r.map(cell).join(',')).join('\n');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }

  function importCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return toast('Nothing to import - the CSV needs a header row and at least one material.');
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (n) => head.indexOf(n);
    if (col('id') < 0 && col('name') < 0) return toast('CSV needs an "id" or "name" column.');
    const sups = SUPPLIERS.filter((s) => s.id !== 'est').map((s) => s.id).filter((s) => col(s) >= 0);
    const cat = catalogue();
    const byName = {};
    for (const m of Object.values(cat)) byName[m.name.toLowerCase()] = m.id;
    let updated = 0, added = 0;
    for (const r of rows.slice(1)) {
      const get = (n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
      let id = get('id') || byName[get('name').toLowerCase()];
      if (!id || !cat[id]) {
        if (!get('name')) continue;
        id = id || 'c_' + uid();
        const est = parseFloat(get('est'));
        state.custom.push({ id, name: get('name'), category: get('category') || 'Other', unit: get('unit') || 'each', prices: isNaN(est) ? {} : { est } });
        cat[id] = true;
        added++;
      }
      for (const s of sups) {
        const v = parseFloat(get(s).replace(/[$,]/g, ''));
        if (!isNaN(v)) { (state.prices[id] = state.prices[id] || {})[s] = v; updated++; }
      }
    }
    save();
    render();
    toast(`Imported ${updated} price${updated === 1 ? '' : 's'}${added ? `, added ${added} new material${added === 1 ? '' : 's'}` : ''}.`);
  }

  // ---------- helpers ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function copy(text, okMsg) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
      toast(ok ? okMsg : 'Could not copy automatically - select the text and copy it.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback);
    else fallback();
  }

  const findBuild = (id) => state.job.builds.find((b) => b.id === id);
  const pendingDelete = new Set();

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) { view = tab.dataset.view; render(); window.scrollTo(0, 0); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const b = btn.dataset.build && findBuild(btn.dataset.build);
    switch (act) {
      case 'add-build':
        state.job.builds.push(makeBuild(btn.dataset.type));
        save(); render();
        $(`#build-${state.job.builds[state.job.builds.length - 1].id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'rm-build':
        state.job.builds = state.job.builds.filter((x) => x !== b); save(); render(); break;
      case 'add-extra': {
        const id = $(`#xm-${b.id}`).value;
        const count = parseFloat($(`#xc-${b.id}`).value);
        if (!(count > 0)) return toast('Enter a quantity above 0.');
        b.extras = b.extras || [];
        b.extras.push({ id, count });
        save(); render(); break;
      }
      case 'rm-extra': b.extras.splice(Number(btn.dataset.n), 1); save(); render(); break;
      case 'new-job':
        if (!pendingDelete.has('new')) { pendingDelete.add('new'); btn.textContent = 'Tap again to clear'; setTimeout(() => pendingDelete.delete('new'), 3000); return; }
        pendingDelete.delete('new');
        state.job = newJob(); save(); render(); toast('Started a new job.'); break;
      case 'save-job': {
        const j = Object.assign(JSON.parse(JSON.stringify(state.job)), { updated: Date.now() });
        const i = state.saved.findIndex((x) => x.id === j.id);
        if (i >= 0) state.saved[i] = j; else state.saved.push(j);
        save(); toast('Job saved on this device.'); break;
      }
      case 'copy-quote': copy(quoteText(), 'Quote copied - paste it into a text or email.'); break;
      case 'copy-list': copy(shoppingText(), 'Shopping list copied.'); break;
      case 'print': window.print(); break;
      case 'open-job': {
        const j = state.saved.find((x) => x.id === btn.dataset.id);
        state.job = JSON.parse(JSON.stringify(j)); view = 'quote'; save(); render(); break;
      }
      case 'copy-job': {
        const j = JSON.parse(JSON.stringify(state.saved.find((x) => x.id === btn.dataset.id)));
        j.id = uid(); j.client = (j.client || 'Job') + ' (copy)'; j.created = Date.now();
        j.builds.forEach((x) => { x.id = uid(); });
        state.job = j; view = 'quote'; save(); render(); break;
      }
      case 'del-job': {
        const key = 'del-' + btn.dataset.id;
        if (!pendingDelete.has(key)) { pendingDelete.add(key); btn.textContent = 'Tap again to delete'; setTimeout(() => pendingDelete.delete(key), 3000); return; }
        state.saved = state.saved.filter((x) => x.id !== btn.dataset.id); save(); render(); toast('Job deleted.'); break;
      }
      case 'add-material': {
        const name = $('#cm-name').value.trim();
        const price = parseFloat($('#cm-price').value);
        if (!name) return toast('Give the material a name.');
        if (!(price >= 0)) return toast('Enter the price including GST.');
        state.custom.push({ id: 'c_' + uid(), name, category: $('#cm-cat').value.trim() || 'Other', unit: $('#cm-unit').value, prices: { est: price } });
        save(); render(); toast(`Added ${name}.`); break;
      }
      case 'dismiss-welcome': state.welcomed = true; save(); render(); break;
      case 'go-help': view = 'help'; render(); window.scrollTo(0, 0); break;
      case 'copy-feedback': copy(feedbackText(), 'Feedback copied. Paste it into a text or email.'); break;
      case 'export-csv': copy(toCsv(), 'Price list copied as CSV - paste into a spreadsheet.'); break;
      case 'import-csv': importCsv($('#csv-text').value); break;
      case 'reset-prices':
        if (!pendingDelete.has('reset')) { pendingDelete.add('reset'); btn.textContent = 'Tap again to clear all your prices'; setTimeout(() => pendingDelete.delete('reset'), 3000); return; }
        pendingDelete.delete('reset');
        state.prices = {}; state.custom = []; save(); render(); toast('Your prices were cleared. Estimates are back.'); break;
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.build) {
      const b = findBuild(el.dataset.build);
      const k = el.dataset.key;
      if (k === '__hours') b.hours = parseFloat(el.value) || 0;
      else if (k === '__label') { b.label = el.value; const h = $(`#build-${b.id} h3`); if (h) h.textContent = el.value || CALCULATORS[b.type].name; }
      else if (el.type === 'checkbox') b.inputs[k] = el.checked;
      else if (el.tagName === 'SELECT') b.inputs[k] = el.value;
      else {
        const v = parseFloat(el.value);
        if (isNaN(v) || v < 0) return;
        b.inputs[k] = el.dataset.len ? fromDisplay(v) : v;
      }
      save(); refreshResults(); return;
    }
    if (el.dataset.job) {
      state.job[el.dataset.job] = el.dataset.job === 'extraCost' ? (parseFloat(el.value) || 0) : el.value;
      save();
      if (el.dataset.job === 'extraCost') { refreshSummaryKeepingFocus(el); }
      return;
    }
    if (el.dataset.price) {
      const v = el.value === '' ? null : parseFloat(el.value);
      const p = (state.prices[el.dataset.price] = state.prices[el.dataset.price] || {});
      if (v == null || isNaN(v)) delete p[el.dataset.sup]; else p[el.dataset.sup] = v;
      save(); return;
    }
    if (el.dataset.fb) { state.feedback[el.dataset.fb] = el.value; save(); return; }
    if (el.dataset.set) {
      const k = el.dataset.set;
      state.settings[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? parseFloat(el.value) || 0 : el.value);
      save(); return;
    }
    if (el.id === 'price-search') {
      const q = el.value.trim().toLowerCase();
      document.querySelectorAll('#price-rows tr[data-name]').forEach((tr) => { tr.hidden = q && !tr.dataset.name.includes(q); });
      document.querySelectorAll('#price-rows tr.cat').forEach((tr) => { tr.hidden = !!q; });
    }
  });

  // The "other costs" input lives inside the summary, so keep focus while re-rendering it.
  function refreshSummaryKeepingFocus(el) {
    const pos = el.selectionStart;
    refreshResults();
    const again = $('#j-extra');
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* number inputs */ } }
  }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'csv-file' && e.target.files[0]) {
      const r = new FileReader();
      r.onload = () => importCsv(String(r.result));
      r.readAsText(e.target.files[0]);
    }
    if (e.target.dataset.set === 'units') render();
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
