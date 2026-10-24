/*
 * Builds the instructions Claude follows to fill a Mitre 10 cart with its
 * browser tool. The text is self-contained so it can be pasted into any
 * Claude chat that has browser access.
 */
(function (root) {
  const STORE = 'Mitre 10 MEGA Lower Hutt';

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : word.endsWith('x') ? 'es' : 's'}`;
  const r2 = (n) => Math.round(n * 100) / 100;

  // What to type into the Mitre 10 search box.
  function searchTerm(line) {
    const name = line.name.replace(/\s*\((box|bag|pair|pack)[^)]*\)/i, '');
    return line.length ? `${name} ${line.length}m` : name;
  }

  // How much to put in the cart, in words Claude can act on.
  function buyText(line) {
    if (line.length) {
      return `${plural(line.count, 'length')} at ${line.length} m (${r2(line.count * line.length)} m total). ` +
        `If ${line.length} m isn't sold, use the next longer length. If it's sold per metre, add ${r2(line.count * line.length)} m.`;
    }
    if (line.unit === 'm') return `${r2(line.count)} m`;
    if (line.unit === 'm3') return `${r2(line.count)} m³`;
    const unit = line.unit === 'each' ? 'item' : line.unit;
    let t = plural(line.count, unit);
    if (line.need != null) t += `. I need about ${line.need} ${line.of}, so if the pack size is different, buy enough packs to cover that`;
    return t;
  }

  function priceUnit(line) {
    if (line.unit === 'm') return 'per metre (divide the price of a length by its length in metres)';
    if (line.unit === 'm3') return 'per m³';
    return `per ${line.unit === 'each' ? 'item' : line.unit}`;
  }

  // Combine cut lengths of the same timber into one cart item. Short cuts
  // (under 1.8 m) aren't sold on their own, so they come off longer lengths.
  function groupLines(lines) {
    const map = new Map();
    for (const l of lines) {
      const g = map.get(l.id);
      if (g) g.parts.push(l); else map.set(l.id, Object.assign({}, l, { parts: [l] }));
    }
    return [...map.values()];
  }

  function groupBuyText(g) {
    if (g.parts.length === 1 && !(g.length && g.length < 1.8)) return buyText(g);
    const cuts = g.parts.filter((p) => p.length);
    const long = cuts.filter((p) => p.length >= 1.8);
    const short = cuts.filter((p) => p.length < 1.8);
    const total = r2(cuts.reduce((a, p) => a + p.count * p.length, 0));
    const bits = long.map((p) => `${plural(p.count, 'length')} at ${p.length} m`);
    if (short.length) {
      const shortM = r2(short.reduce((a, p) => a + p.count * p.length, 0));
      bits.push(`plus ${short.map((p) => `${p.count} x ${p.length} m`).join(', ')} short cuts (${shortM} m) - buy extra lengths to cut these from`);
    }
    return `${bits.join(', ')}. ${total} m in total. If a length isn't sold, use the next longer one. If it's sold per metre, add ${total} m.`;
  }

  function cartInstructions(lines, job) {
    const out = [];
    out.push(`Please use your browser to fill my Mitre 10 cart for a building job. Go to https://www.mitre10.co.nz and set my store to ${STORE}.`);
    if (job && (job.client || job.address)) out.push(`Job: ${[job.client, job.address].filter(Boolean).join(', ')}`);
    out.push('');
    out.push('Rules:');
    out.push('- Add the items one at a time: search, pick the best match, set the quantity, then Add to Cart.');
    out.push('- Match the size and timber treatment exactly (e.g. H3.2 vs H4, 100x50 vs 75x50). If there is no exact match, pick the closest one and tell me what you changed.');
    out.push(`- Prefer products in stock for Click & Collect at ${STORE}.`);
    out.push('- Do not check out, enter payment details or change my account. If you have to sign in to add to cart, stop and ask me to sign in.');
    out.push('- If you cannot find something after a couple of searches, skip it and keep going.');
    out.push('');
    out.push('Items:');
    const groups = groupLines(lines);
    groups.forEach((g, i) => {
      out.push(`${i + 1}. ${g.name} [${g.id}]`);
      out.push(`   Buy: ${groupBuyText(g)}`);
      out.push(`   Search for: ${g.parts.length > 1 ? searchTerm(Object.assign({}, g, { length: null })) : searchTerm(g)}`);
    });
    out.push('');
    out.push('When you are done, reply with:');
    out.push('1. A table of what you added: item, the Mitre 10 product name, quantity and price.');
    out.push('2. A list of anything you skipped or substituted, and why.');
    out.push('3. The cart total.');
    out.push('4. A CSV code block I can import into my quoting app, with the header line "id,mitre10".');
    out.push('   One row per item you found. Use the id in [brackets] above, and the price including GST in these units:');
    for (const g of groups) out.push(`   ${g.id}: ${priceUnit(g)}`);
    return out.join('\n');
  }

  const api = { STORE, searchTerm, buyText, groupLines, cartInstructions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SQ_CART = api;
})(this);
