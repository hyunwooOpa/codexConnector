# PC Upgrade Tracker

[Live app](https://hyunwooopa.github.io/codexConnector/)

Track exact PC components and peripherals across Germany, Netherlands, Poland and Belgium. Categories cover monitors, GPUs, memory, CPUs, motherboards, storage, power supplies, cases, cooling, keyboards, mice, controllers, webcams, audio, networking, accessories and other PC products.

## Product catalog

`data/products.json` is the authoritative shared catalog. The app and scheduled collector read it; the selector no longer hard-codes Philips models. Existing Philips products retain their exact `model` identifiers so all price history continues to work. `data/monitors.json` is a legacy compatibility file, no longer used by the app or collector.

Each product has a unique exact `model` (manufacturer part number / variant identifier), `name`, `category`, optional `brand`, `variant`, `product_url`, `target_price_eur`, and `enabled` (default true). Distinct capacities, kit sizes, board models, keyboard layouts and switches must be separate catalog items. Model keys are case-sensitive. Do not rename an existing key without migrating its history.

The optional `tracking_role` is `primary` (the item being considered) or `competitor` (an alternative from another brand). A competitor can list exact primary model keys in `competitor_of`, plus a human-readable `competitor_reason`, `discovery_source_url`, and an optional discovery price. Discovery fields are lead information only; they never become a current price observation. Enabled competitors are researched in all four countries with the same exact-variant and lowest-price rules as primary products. The current competitor set includes comparable 34-inch curved 3440×1440 IPS and VA office ultrawides, selected for documented flicker-free/eye-comfort features and matching physical format. The dashboard keeps their price lines separate and lets you filter Primary products or Competitors. A relationship does not claim identical specifications or compatibility.

To add a product, use the app's draft form, export the catalog, and publish its contents to `data/products.json` on main using the linked GitHub editor. Or ask the assistant to add exact products directly to the catalog. Until publication, drafts are device-only and are not scheduled for research. Local changes to published products also require export/publication to change automated tracking. There is no GitHub credential or silent write access in the public app.

Target prices, Planned / Shortlisted / Purchased status, and compatibility notes save in browser local storage. Export includes catalog details and targets, but not private notes or shopping status. Clearing browser storage clears local drafts and planning data. Legacy local monitor drafts are imported automatically. Imported catalogs add new product drafts; published records remain authoritative. The app never infers hardware compatibility from a note.

## Price history and selection

`data/price-history.json` retains all historical observations. Its `model` field is the product key for all categories. The app displays full history with product/category/country filters and shows one price line per visible product. Country controls determine card and chart minima; the history table has its own country filter. Unknown and invalidated prices are not plotted as real prices. Latest cards expire after ten hours; chart minima combine observations at most ten hours apart. Shipping is separate from the VAT-inclusive item price and belongs in status notes. Orderable preorders must be clearly labelled; orderability does not mean in stock.

For every enabled catalog product, the collector checks four countries. Each normal batch contains exactly `enabled products × 4` observations (currently 44 after narrowing the active set). It uses Tweakers's explicit NL and BE views, Beslist NL/BE, Idealo, Geizhals, Ceneo and reputable local retailers. Amazon.nl, Amazon.de, Amazon.pl and Amazon.com.be are researched only through search and third-party comparison sources. Do not open Amazon pages/APIs to verify prices. History rows carry `tracking_role` and `competitor_of` when applicable so primary and competitor histories cannot be confused. Catalog entries with `enabled:false` remain preserved for historical reference but are not searched or appended.

Candidate batches need `observed_at`, `fx_eur_pln`, `fx_source_url`, `fx_checked_at`, and `offers`. Each offer needs exact `model`, `country`, `retailer`, `retailer_country`, local `original_currency`, `original_price`, `vat_included:true`, `checked_at`, `verification`, and `url`. Retailer-confirmed offers need `orderable:true`. Comparison-listed offers may have `orderable:null` with explicit uncertainty and need `comparison_url`, `comparison_seller`, and `comparison_seller_country` matching the country. The seller's actual local offer is authoritative, not the comparison site's domain.

Every offer also needs `evidence_type` (`live-page` or `user-screenshot`) and `source_timestamp_status` (`dated` or `not-displayed`). Copy a displayed source offer date into `source_price_at`; dated prices older than two hours fail even with a fresh retrieval timestamp. Use `not-displayed` only when the inspected live listing has no timestamp. Cached snippets are discovery leads, not current price evidence. Keep shipping, stock and preorder qualifications in `status_note`.

The selector validates every supplied candidate before selecting the minimum, fails on unsupported candidates, and creates null-price rows for missing pairs. It cannot independently fetch or authenticate sources; assertions must be supported by current evidence. Lower known listings must be investigated, not omitted to make a higher price appear cheapest. Polish prices are converted using the checked rate. Prior unsupported observations stay as `invalidated_observation` audit records with null active prices.

Run:

```sh
node --test scripts/select-lowest.test.mjs
node scripts/select-lowest.mjs candidate-batch.json --history data/price-history.json
```

Scheduled checks run at 08:00, 11:00, 14:00, 17:00, 20:00 and 23:00 Europe/Amsterdam. They reread the catalog each run, preserve history and report sources and uncertainties. No sample component prices are seeded into the live data.
