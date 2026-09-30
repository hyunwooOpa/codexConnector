# Philips Monitor Price Tracker

Public GitHub Pages dashboard for tracking Philips ultrawide monitor prices across Germany, the Netherlands, Poland, and Belgium.

**Live dashboard:** https://hyunwooopa.github.io/codexConnector/

Tracked models:
- 34B2U5900C
- 34B2U6603CH
- 34B2U5600C
- 34E1C5600AM

Data lives in `data/monitors.json` and `data/price-history.json`. Missing prices are shown as unavailable/pending rather than estimated.

The page is designed for GitHub Pages and the price history can be updated by appending observations to `data/price-history.json`.

Price checks include [Amazon.nl](https://www.amazon.nl/), [Amazon.de](https://www.amazon.de/), [Amazon.pl](https://www.amazon.pl/), and [Tweakers Pricewatch](https://tweakers.net/monitors/), alongside other local retailers. Each recorded price should link to the exact offer used; the presence of a source does not imply every model is available there.

## Selecting observations

The browser reads history; it does not search retailers. The scheduled collector must compare **all freshly checked candidate offers for each exact model and country** before appending a batch. `scripts/select-lowest.mjs` validates candidate assertions and chooses the least expensive eligible offer per pair, yielding 16 observations. An empty pair becomes unavailable with null prices. A lower exact-model Pricewatch or other local comparison listing can win with `verification: "Pricewatch-listed; retailer checkout price not independently confirmed"` or `"Comparison-listed; retailer checkout price not independently confirmed"`; the dashboard labels it as a listing that needs retailer confirmation.

Candidate input is a JSON object with `observed_at` (ISO timestamp), `fx_eur_pln`, `fx_source_url`, `fx_checked_at`, and `offers`. Each offer needs the exact `model`, `country`, `retailer`, `retailer_country`, local `original_currency` and `original_price`, `vat_included: true`, `checked_at`, and `verification`. Retailer-confirmed offers require `orderable: true` and a direct retailer `url`. A labelled comparison offer can use `orderable: null` when checkout stock is unreadable, and can use its exact-product `comparison_url` as the link when no direct retailer URL is known. Comparison offers also need the seller name exactly as shown in `comparison_seller` and `comparison_seller_country` matching the tracked country. A Belgian comparison seller cannot establish a Dutch price. A claim must be supported by the checked source; the script cannot independently inspect a web page or prove market-wide coverage. Any uncertain lower listing must be investigated before selection rather than omitted from the input.

Run `node --test scripts/select-lowest.test.mjs` and then `node scripts/select-lowest.mjs candidate-batch.json --history data/price-history.json`. The command appends 16 observations to the existing array. Review the diff and commit the history. Current dashboard prices expire after two hours; historical chart points only combine country observations checked within two hours of one another.

Historical observations with unsupported prices are retained as `invalidated_observation` audit records and have `available: false` with null prices. They do not contribute to current cards or the historical price line. The correction reason is recorded per row.

## Price evidence freshness

Candidate offers must include `evidence_type` (`live-page` or `user-screenshot`) and `source_timestamp_status` (`dated` or `not-displayed`). If the source displays an offer timestamp, set `source_timestamp_status: "dated"` and copy it into `source_price_at` as ISO 8601; the selector rejects source prices older than two hours even when `checked_at` is fresh. Use `not-displayed` only after checking that the live offer has no timestamp. Cached search snippets are discovery leads, not current price evidence. Never relabel a known old source date as not displayed. Keep preorder dates and shipping qualifications in `status_note`; orderability does not mean in stock. The selector retains source evidence fields and status notes. It validates supplied evidence metadata but does not independently fetch or authenticate source pages.

## Belgium

Belgium is a separate EUR market for all four models (16 model-country pairs per scheduled run). Search Tweakers with Belgium explicitly selected and Beslist.be, plus Belgian offers from Redable.be, Alternate.be, Coolblue.be and other local retailers. Search Amazon.com.be separately through web search and third-party comparison sources only. Preserve the actual seller and Belgian storefront evidence; a Belgian seller does not establish a Dutch price. Belgian history begins with its first actual observation; do not backfill invented prices. The existing 08:00, 11:00, 14:00, 17:00, 20:00 and 23:00 Europe/Amsterdam schedule remains in place.
