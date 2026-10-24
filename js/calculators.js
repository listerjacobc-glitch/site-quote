/*
 * Build calculators: turn a job description (dimensions etc.) into a list of
 * material lines. All lengths are metres internally.
 *
 * A calculator returns lines of the form
 *   { id, count }            – buy `count` of the material
 *   { id, count, length }    – `count` pieces of timber cut at `length` metres
 *   { id, need }             – need this many "of" (nails, m², ...); converted to
 *                              packs using the material's `per` value
 * plus an optional `note` explaining where the number came from.
 *
 * The rules of thumb here follow common NZ residential practice but are not a
 * substitute for NZS 3604, manufacturer specs or an engineer.
 */
(function (root) {
  // Common NZ timber stock lengths (m)
  const STOCK = [0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 4.8, 5.4, 6.0];
  const MAX_STOCK = 6.0;
  const EPS = 1e-9;

  function stockLength(len) {
    for (const s of STOCK) if (s + EPS >= len) return s;
    return MAX_STOCK;
  }

  // Pieces needed to cover a continuous run, e.g. a rail along a fence line.
  function piecesForRun(run) {
    if (run <= 0) return { count: 0, length: 0 };
    const count = Math.ceil(run / MAX_STOCK - EPS);
    return { count, length: stockLength(run / count) };
  }

  // Split litres of paint into 10L and 4L tins with little leftover.
  function paintTins(litres) {
    if (litres <= 0) return { ten: 0, four: 0 };
    let ten = Math.floor(litres / 10);
    const rest = litres - ten * 10;
    let four = Math.ceil(rest / 4 - EPS);
    if (four >= 3) { ten += 1; four = 0; } // 3x4L costs more than a 10L
    return { ten, four };
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  const CALCULATORS = {
    fence: {
      name: 'Paling fence',
      fields: [
        { key: 'length', label: 'Fence length', type: 'length', default: 10 },
        { key: 'height', label: 'Height', type: 'length', default: 1.8 },
        { key: 'spacing', label: 'Max post spacing', type: 'length', default: 2.4 },
        { key: 'style', label: 'Paling layout', type: 'select', default: 'butt',
          options: [['butt', 'Butted (no gaps)'], ['gap', '20mm gaps'], ['lapped', 'Lapped / double-sided']] },
        { key: 'rail', label: 'Rail size', type: 'select', default: 'rail_100x50_h32',
          options: [['rail_100x50_h32', '100x50'], ['rail_75x50_h32', '75x50']] },
        { key: 'gates', label: 'Gates', type: 'number', default: 0 },
        { key: 'gateWidth', label: 'Gate width', type: 'length', default: 0.9 },
      ],
      compute(i) {
        const lines = [];
        const notes = [];
        const fenceLen = Math.max(0, i.length - i.gates * i.gateWidth);
        const bays = Math.max(1, Math.ceil(i.length / i.spacing - EPS));
        const posts = bays + 1 + i.gates; // each gate adds a post to hang it from
        const embed = Math.max(0.6, i.height / 3);
        const big = i.height > 1.8;
        const postId = big ? 'post_125_h4' : 'post_100_h4';
        lines.push({ id: postId, count: posts, length: stockLength(i.height + embed),
          note: `${bays} bays, ${round2(embed)} m in ground` });

        const rows = i.height <= 1.2 ? 2 : 3;
        const run = piecesForRun(fenceLen);
        lines.push({ id: i.rail, count: run.count * rows, length: run.length, note: `${rows} rails high` });

        const cover = { butt: 0.15, gap: 0.17, lapped: 0.1 }[i.style] || 0.15;
        const palingLen = stockLength(Math.max(0.9, i.height - 0.05));
        const palings = Math.ceil(fenceLen / cover - EPS);
        const gatePalings = i.gates * Math.ceil(i.gateWidth / cover - EPS);
        lines.push({ id: 'paling_150x25_h32', count: palings + gatePalings, length: palingLen });

        lines.push({ id: 'nail_paling_60', need: (palings + gatePalings) * rows * 2, note: '2 per paling per rail' });
        lines.push({ id: 'nail_100_galv', need: posts * rows * 3 + i.gates * 12 });

        const holeDia = big ? 0.3 : 0.25;
        const postW = big ? 0.125 : 0.1;
        const vol = Math.PI * (holeDia / 2) ** 2 * (embed + 0.05) - postW * postW * embed;
        const bagsPerPost = Math.ceil(vol / 0.01 - EPS); // ~0.01 m³ per 20kg bag
        lines.push({ id: 'postmix_20', count: posts * bagsPerPost, note: `${bagsPerPost} bags per post` });

        if (i.gates > 0) {
          const brace = Math.hypot(i.gateWidth, i.height);
          lines.push({ id: i.rail, count: i.gates * rows, length: stockLength(i.gateWidth), note: 'gate rails' });
          lines.push({ id: i.rail, count: i.gates, length: stockLength(brace), note: 'gate brace' });
          lines.push({ id: 'gate_hinge', count: i.gates });
          lines.push({ id: 'gate_latch', count: i.gates });
        }
        if (i.height > 2) notes.push('Fences over 2.0 m generally need building consent.');
        return { lines, notes };
      },
    },

    deck: {
      name: 'Timber deck',
      fields: [
        { key: 'length', label: 'Deck length (along house)', type: 'length', default: 4.8 },
        { key: 'width', label: 'Deck depth (out from house)', type: 'length', default: 3.0 },
        { key: 'height', label: 'Height above ground', type: 'length', default: 0.5 },
        { key: 'boards', label: 'Decking', type: 'select', default: 'deck_pine_140x32',
          options: [['deck_pine_140x32', 'Pine 140x32'], ['deck_pine_90x19', 'Pine 90x19'], ['deck_kwila_90x19', 'Kwila 90x19']] },
        { key: 'joistSpacing', label: 'Joist spacing', type: 'select', default: '0.45',
          options: [['0.45', '450mm'], ['0.4', '400mm'], ['0.6', '600mm']] },
        { key: 'attached', label: 'Fixed to house (ledger)', type: 'checkbox', default: true },
      ],
      compute(i) {
        const lines = [];
        const notes = [];
        const spacing = Number(i.joistSpacing);
        const bearerRows = Math.ceil(i.width / 1.6 - EPS) + (i.attached ? 0 : 1);
        const pilesPerRow = Math.ceil(i.length / 1.3 - EPS) + 1;
        const piles = bearerRows * pilesPerRow;
        lines.push({ id: 'pile_125_h5', count: piles, length: stockLength(Math.max(0.9, i.height + 0.45)),
          note: `${bearerRows} rows x ${pilesPerRow}` });
        lines.push({ id: 'postmix_20', count: piles * 3, note: '3 bags per pile' });
        lines.push({ id: 'wire_dog', count: piles * 2 });

        const bearer = piecesForRun(i.length);
        lines.push({ id: 'joist_140x45_h32', count: bearer.count * bearerRows * 2, length: bearer.length,
          note: 'bearers (doubled 140x45)' });

        const joists = Math.ceil(i.length / spacing - EPS) + 1;
        const joistRun = piecesForRun(i.width);
        lines.push({ id: 'joist_140x45_h32', count: joists * joistRun.count, length: joistRun.length,
          note: `${joists} joists @ ${spacing * 1000}mm` });
        lines.push({ id: 'joist_140x45_h32', count: bearer.count * 2, length: bearer.length,
          note: i.attached ? 'boundary joist + ledger' : 'boundary joists' });

        const boardW = i.boards === 'deck_pine_140x32' ? 0.14 : 0.09;
        const rowsOfBoards = Math.ceil(i.width / (boardW + 0.004) - EPS);
        const boardRun = piecesForRun(i.length);
        lines.push({ id: i.boards, count: rowsOfBoards * boardRun.count, length: boardRun.length,
          note: `${rowsOfBoards} rows of boards` });
        lines.push({ id: 'screw_deck_ss', need: rowsOfBoards * joists * 2, note: '2 per board per joist' });
        lines.push({ id: 'nail_100_galv', need: joists * 4 + piles * 4 });

        if (i.attached) {
          lines.push({ id: 'joist_hanger', count: joists });
          lines.push({ id: 'bolt_m12_ledger', count: Math.ceil(i.length / 0.6 - EPS) + 1 });
        }
        if (i.height > 1) notes.push('Over 1.0 m above ground needs a barrier/balustrade (not included).');
        if (i.height > 1.5) notes.push('Decks over 1.5 m above ground generally need building consent.');
        notes.push('Check bearer/joist spans against NZS 3604 for the actual site.');
        return { lines, notes };
      },
    },

    wall: {
      name: 'Framed wall + GIB',
      fields: [
        { key: 'length', label: 'Wall length', type: 'length', default: 4 },
        { key: 'height', label: 'Stud height', type: 'length', default: 2.4 },
        { key: 'sides', label: 'Sides lined', type: 'select', default: '2', options: [['1', 'One side'], ['2', 'Both sides'], ['0', 'Framing only']] },
        { key: 'openings', label: 'Doors/windows area (m²)', type: 'number', default: 0 },
        { key: 'insulate', label: 'Insulation', type: 'checkbox', default: false },
      ],
      compute(i) {
        const lines = [];
        const notes = [];
        const studs = Math.ceil(i.length / 0.6 - EPS) + 1 + 2; // +2 for ends/junctions
        lines.push({ id: 'stud_90x45_h12', count: studs, length: stockLength(i.height), note: 'studs @ 600mm' });
        const plate = piecesForRun(i.length);
        lines.push({ id: 'stud_90x45_h12', count: plate.count * 2, length: plate.length, note: 'top + bottom plates' });
        const nogRows = Math.max(1, Math.ceil(i.height / 1.35 - EPS) - 1);
        const nog = piecesForRun(i.length);
        lines.push({ id: 'stud_90x45_h12', count: nog.count * nogRows, length: nog.length, note: `${nogRows} row(s) of nogs` });
        lines.push({ id: 'nail_frame_gun', need: studs * 8 + nog.count * nogRows * 10 });

        const sides = Number(i.sides);
        const area = Math.max(0, i.length * i.height * sides - i.openings * sides);
        if (sides > 0) {
          const tall = i.height > 2.4 + EPS;
          const sheetArea = tall ? 3.24 : 2.88;
          lines.push({ id: tall ? 'gib_10_2700' : 'gib_10_2400', count: Math.ceil(area / sheetArea - EPS),
            note: `${round2(area)} m² lined` });
          lines.push({ id: 'gib_screw_32', need: Math.ceil(area / sheetArea) * 30 });
          lines.push({ id: 'gib_tradeset', need: area });
          lines.push({ id: 'gib_plus4', need: area });
          lines.push({ id: 'gib_tape', need: area * 1.3 });
        }
        if (i.insulate) {
          lines.push({ id: 'insul_wall_r26', need: Math.max(0, i.length * i.height - i.openings) });
        }
        if (i.height > 2.7) notes.push('Studs over 2.7 m may need a larger section - check NZS 3604.');
        return { lines, notes };
      },
    },

    paint: {
      name: 'Paint a room',
      fields: [
        { key: 'length', label: 'Room length', type: 'length', default: 4 },
        { key: 'width', label: 'Room width', type: 'length', default: 3.5 },
        { key: 'height', label: 'Ceiling height', type: 'length', default: 2.4 },
        { key: 'doors', label: 'Doors', type: 'number', default: 1 },
        { key: 'windows', label: 'Windows', type: 'number', default: 1 },
        { key: 'coats', label: 'Coats', type: 'number', default: 2 },
        { key: 'ceiling', label: 'Paint ceiling', type: 'checkbox', default: true },
        { key: 'seal', label: 'Sealer / undercoat first', type: 'checkbox', default: false },
      ],
      compute(i) {
        const lines = [];
        const COVER = 12; // m² per litre per coat
        const perimeter = 2 * (i.length + i.width);
        const walls = Math.max(0, perimeter * i.height - i.doors * 1.9 - i.windows * 1.5);
        const ceil = i.length * i.width;
        const wallTins = paintTins((walls * i.coats) / COVER);
        if (wallTins.ten) lines.push({ id: 'paint_wall_10', count: wallTins.ten, note: `${round2(walls)} m² walls x ${i.coats}` });
        if (wallTins.four) lines.push({ id: 'paint_wall_4', count: wallTins.four });
        if (i.ceiling) {
          const c = paintTins((ceil * i.coats) / COVER);
          if (c.ten) lines.push({ id: 'paint_ceiling_10', count: c.ten, note: `${round2(ceil)} m² ceiling` });
          if (c.four) lines.push({ id: 'paint_ceiling_4', count: c.four });
        }
        if (i.seal) {
          const sealArea = walls + (i.ceiling ? ceil : 0);
          lines.push({ id: 'paint_sealer_4', count: Math.ceil(sealArea / COVER / 4 - EPS) });
        }
        lines.push({ id: 'paint_roller_kit', count: 1 });
        lines.push({ id: 'masking_tape', need: perimeter * 2 + i.doors * 5 + i.windows * 5 });
        lines.push({ id: 'drop_sheet', count: 2 });
        return { lines, notes: [] };
      },
    },

    slab: {
      name: 'Concrete slab / path',
      fields: [
        { key: 'length', label: 'Length', type: 'length', default: 3 },
        { key: 'width', label: 'Width', type: 'length', default: 3 },
        { key: 'thickness', label: 'Concrete thickness (mm)', type: 'number', default: 100 },
        { key: 'base', label: 'Basecourse thickness (mm)', type: 'number', default: 75 },
        { key: 'mesh', label: 'Reinforcing mesh', type: 'checkbox', default: true },
        { key: 'dpm', label: 'Polythene underlay', type: 'checkbox', default: false },
        { key: 'supply', label: 'Concrete supply', type: 'select', default: 'auto',
          options: [['auto', 'Auto (bags under 0.5 m³)'], ['bags', 'Bags'], ['readymix', 'Ready-mix truck']] },
      ],
      compute(i) {
        const lines = [];
        const notes = [];
        const area = i.length * i.width;
        const vol = area * (i.thickness / 1000);
        const useBags = i.supply === 'bags' || (i.supply === 'auto' && vol < 0.5);
        if (useBags) {
          lines.push({ id: 'concrete_20', count: Math.ceil((vol * 1.05) / 0.0095 - EPS), note: `${round2(vol)} m³ (~0.0095 m³ per bag)` });
        } else {
          const m3 = Math.ceil(vol * 1.05 * 5 - EPS) / 5; // round up to 0.2 m³
          lines.push({ id: 'readymix_m3', count: m3, note: `${round2(vol)} m³ + 5%` });
          if (m3 < 3) lines.push({ id: 'readymix_small_load', count: 1 });
        }
        if (i.mesh) {
          lines.push({ id: 'mesh_se62', count: Math.ceil(area / 10.1 - EPS), note: 'allows 200mm laps' });
          lines.push({ id: 'mesh_chairs', need: area * 4 });
        }
        if (i.dpm) lines.push({ id: 'dpm_poly', need: area * 1.1 });
        const sideL = piecesForRun(i.length);
        const sideW = piecesForRun(i.width);
        lines.push({ id: 'boxing_150x25', count: sideL.count * 2, length: sideL.length, note: 'boxing' });
        lines.push({ id: 'boxing_150x25', count: sideW.count * 2, length: sideW.length, note: 'boxing' });
        lines.push({ id: 'peg_50x50', count: Math.ceil(2 * (i.length + i.width) / 0.9 - EPS) + 4 });
        if (i.base > 0) {
          const baseM3 = Math.ceil(area * (i.base / 1000) * 1.3 * 2 - EPS) / 2; // compaction, round to 0.5
          lines.push({ id: 'gap40_m3', count: baseM3, note: 'incl. 30% compaction' });
        }
        if (i.thickness > 150) notes.push('Thick slabs may need engineering - check.');
        return { lines, notes };
      },
    },
  };

  const api = { CALCULATORS, STOCK, stockLength, piecesForRun, paintTins };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SQ_CALC = api;
})(this);
