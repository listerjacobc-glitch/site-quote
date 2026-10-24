# Site Quote

A small web app for quoting building jobs on site. Enter what's being built
(fence length and height, deck size, wall length...) and it works out the
materials list, prices each item, and totals the quote with margin, labour and GST.

Example: a 10 m x 1.8 m paling fence gives

| Qty | Material |
| --- | --- |
| 6 × 2.4 m | 100x100 H4 posts |
| 6 × 5.4 m | 100x50 H3.2 rails (3 high) |
| 74 × 1.8 m | 150x25 H3.2 palings (incl. 10% waste) |
| 2 boxes (402 nails) | 60mm galv paling nails 1kg |
| 18 bags | Post mix 20kg |

...each with a price, and a combined shopping list grouped by supplier.

## Builds it can calculate

- **Paling fence**: posts, rails, palings, nails, concrete, gates and hardware
- **Timber deck**: piles, bearers, joists, decking boards, screws, hangers, ledger bolts
- **Framed wall + GIB**: studs, plates, nogs, GIB sheets, screws, stopping, tape, insulation
- **Paint a room**: wall/ceiling paint in 10L/4L tins, sealer, rollers, tape
- **Concrete slab / path**: bags or ready-mix, mesh, chairs, boxing, pegs, basecourse

Any build can also have extra materials added by hand, and you can add your own
materials to the price list.

## Prices

Prices are kept per supplier: Bunnings, Mitre 10 MEGA, PlaceMakers, Carters and ITM
(Lower Hutt branches). The app uses your preferred supplier, or the cheapest price
entered.

**The built-in prices are rough estimates, shown in amber as "Estimate (verify)".**
They aren't live supplier prices. Before sending real quotes, enter actual prices on the
**Prices** tab, or use *Copy CSV*, update it in a spreadsheet with your trade account
pricing, and paste it back with *Import*.

The big NZ merchants don't offer a public price API, and trade pricing is
account-specific anyway, so prices you enter yourself are the reliable source.

## Running it

It's a static site with no build step and no server.

- **Easiest:** turn on GitHub Pages for this repo (Settings → Pages → deploy from
  `main`, root folder) and open the link on your phone. Use "Add to Home Screen" to
  install it. It then works offline on site.
- **Locally:** `npm start` (serves the folder), or just open `index.html` in a browser.

Everything (prices, saved jobs, settings) is stored on the device in the browser.
Use *Copy CSV* to back up your price list.

## Rules of thumb used

The calculators use common NZ residential practice: posts 600 mm in the ground (or a
third of the height), 3 rails on fences over 1.2 m, joists at 450 mm, bearers at
1.6 m max, studs at 600 mm, paint at 12 m²/L per coat, and so on. They're for quoting,
**not** structural design. Check spans and fixings against NZS 3604 and manufacturer
specs, and note the consent warnings the app shows (fences over 2 m, decks over 1.5 m).

## Development

```
npm test   # calculator and pricing tests (Node 18+)
```

- `js/materials.js` – material catalogue, suppliers and estimate prices
- `js/calculators.js` – build calculators (dimensions → material lines)
- `js/quote.js` – waste, pack sizes, supplier price choice, GST and totals
- `js/app.js` – the UI
