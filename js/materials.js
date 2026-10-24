/*
 * Default material catalogue and supplier list.
 *
 * Prices are NZD *including GST*, as shown on the shelf / website.
 * The "est" column holds rough Wellington-region retail estimates so the app
 * works out of the box. They are NOT live supplier prices: update them on the
 * Prices tab (or import a CSV) with real figures from your trade account or
 * the supplier websites.
 *
 * unit      – what you buy: m (per linear metre), each, box, bag, sheet, tin, roll, pack, m3
 * per/of    – for things bought in packs: how many "of" come in one unit
 *             (e.g. a 1kg box holds ~300 paling nails)
 * waste     – true if the global waste % should be added (timber, sheets, boards)
 */
(function (root) {
  const SUPPLIERS = [
    { id: 'est', name: 'Estimate (verify)' },
    { id: 'bunnings', name: 'Bunnings Lower Hutt' },
    { id: 'mitre10', name: 'Mitre 10 MEGA Lower Hutt' },
    { id: 'placemakers', name: 'PlaceMakers Lower Hutt' },
    { id: 'carters', name: 'Carters Lower Hutt' },
    { id: 'itm', name: 'ITM Lower Hutt' },
  ];

  const M = (id, category, name, unit, est, extra) =>
    Object.assign({ id, category, name, unit, prices: { est } }, extra || {});

  const MATERIALS = [
    // Fencing timber
    M('post_100_h4', 'Fencing', '100x100 H4 rough sawn post', 'm', 11.5),
    M('post_125_h4', 'Fencing', '125x125 H4 rough sawn post', 'm', 17.5),
    M('rail_100x50_h32', 'Fencing', '100x50 H3.2 rough sawn rail', 'm', 6.5, { waste: true }),
    M('rail_75x50_h32', 'Fencing', '75x50 H3.2 rough sawn rail', 'm', 4.8, { waste: true }),
    M('paling_150x25_h32', 'Fencing', '150x25 H3.2 rough sawn paling', 'm', 2.6, { waste: true }),
    M('nail_paling_60', 'Fixings', '60x2.8 galv jolt head nails 1kg', 'box', 19.0, { per: 300, of: 'nails' }),
    M('nail_100_galv', 'Fixings', '100x4.0 galv flat head nails 1kg', 'box', 18.0, { per: 100, of: 'nails' }),
    M('postmix_20', 'Concrete', 'Post mix concrete 20kg bag', 'bag', 12.5),
    M('gate_hinge', 'Hardware', 'Gate T-hinge 300mm galv (pair)', 'pack', 26.0),
    M('gate_latch', 'Hardware', 'Gate latch galv', 'each', 22.0),

    // Decking
    M('pile_125_h5', 'Decking', '125x125 H5 pile', 'm', 21.0),
    M('joist_140x45_h32', 'Decking', '140x45 H3.2 SG8 joist/bearer', 'm', 9.2, { waste: true }),
    M('deck_pine_90x19', 'Decking', '90x19 H3.2 pine decking', 'm', 4.3, { waste: true }),
    M('deck_pine_140x32', 'Decking', '140x32 H3.2 pine decking', 'm', 8.4, { waste: true }),
    M('deck_kwila_90x19', 'Decking', '90x19 kwila decking', 'm', 12.5, { waste: true }),
    M('screw_deck_ss', 'Fixings', 'Decking screws 10g x 65 stainless (box 500)', 'box', 115.0, { per: 500, of: 'screws' }),
    M('joist_hanger', 'Hardware', 'Joist hanger 140x45 galv', 'each', 3.5),
    M('wire_dog', 'Hardware', 'Wire dog / pile fixing', 'each', 2.5),
    M('bolt_m12_ledger', 'Hardware', 'M12 x 150 galv coach bolt + washer', 'each', 4.5),

    // Framing & lining
    M('stud_90x45_h12', 'Framing', '90x45 H1.2 MSG8 framing', 'm', 5.6, { waste: true }),
    M('nail_frame_gun', 'Fixings', '90x3.15 framing gun nails (box 2500)', 'box', 95.0, { per: 2500, of: 'nails' }),
    M('gib_10_2400', 'Lining', 'GIB Standard 10mm 2400x1200', 'sheet', 34.0, { waste: true }),
    M('gib_10_2700', 'Lining', 'GIB Standard 10mm 2700x1200', 'sheet', 39.0, { waste: true }),
    M('gib_screw_32', 'Fixings', 'GIB grabber screws 32mm (box 1000)', 'box', 32.0, { per: 1000, of: 'screws' }),
    M('gib_tradeset', 'Lining', 'GIB Tradeset base coat 10kg', 'bag', 38.0, { per: 30, of: 'm² stopped' }),
    M('gib_plus4', 'Lining', 'GIB Plus 4 finish compound 15L', 'tin', 52.0, { per: 40, of: 'm² stopped' }),
    M('gib_tape', 'Lining', 'Paper jointing tape 75m roll', 'roll', 9.0, { per: 75, of: 'm tape' }),
    M('insul_wall_r26', 'Insulation', 'R2.6 wall insulation batts (pack)', 'pack', 89.0, { per: 6.5, of: 'm²' }),

    // Painting
    M('paint_wall_10', 'Paint', 'Interior wall paint low sheen 10L', 'tin', 225.0),
    M('paint_wall_4', 'Paint', 'Interior wall paint low sheen 4L', 'tin', 115.0),
    M('paint_ceiling_10', 'Paint', 'Ceiling paint flat 10L', 'tin', 165.0),
    M('paint_ceiling_4', 'Paint', 'Ceiling paint flat 4L', 'tin', 85.0),
    M('paint_sealer_4', 'Paint', 'Sealer / undercoat 4L', 'tin', 95.0),
    M('paint_roller_kit', 'Paint', 'Roller kit (frame, sleeve, tray)', 'each', 28.0),
    M('masking_tape', 'Paint', 'Masking tape 36mm x 50m', 'roll', 8.0, { per: 50, of: 'm' }),
    M('drop_sheet', 'Paint', 'Drop sheet 3.6 x 2.7m', 'each', 15.0),

    // Concrete
    M('concrete_20', 'Concrete', 'Concrete mix 20kg bag', 'bag', 10.5),
    M('readymix_m3', 'Concrete', 'Ready-mix concrete 20MPa', 'm3', 340.0),
    M('readymix_small_load', 'Concrete', 'Ready-mix small load / delivery fee', 'each', 250.0),
    M('mesh_se62', 'Concrete', 'SE62 reinforcing mesh 4.8x2.4m', 'sheet', 95.0),
    M('mesh_chairs', 'Concrete', 'Mesh chairs (bag 100)', 'bag', 28.0, { per: 100, of: 'chairs' }),
    M('boxing_150x25', 'Concrete', '150x25 boxing timber', 'm', 3.2, { waste: true }),
    M('peg_50x50', 'Concrete', '50x50 timber peg 450mm', 'each', 2.2),
    M('dpm_poly', 'Concrete', 'Polythene DPM 4x25m roll', 'roll', 145.0, { per: 100, of: 'm²' }),
    M('gap40_m3', 'Concrete', 'GAP40 basecourse (per m³)', 'm3', 85.0),
  ];

  const api = { SUPPLIERS, MATERIALS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SQ_DATA = api;
})(this);
