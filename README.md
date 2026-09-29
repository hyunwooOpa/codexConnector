# Philips Monitor Price Tracker

Public GitHub Pages dashboard for tracking Philips ultrawide monitor prices across Germany, the Netherlands, and Poland.

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

The browser reads history; it does not search retailers. The hourly collector must compare **all freshly checked candidate offers for each exact model and country** before appending a batch. `scripts/select-lowest.mjs` validates candidate assertions and chooses the least expensive eligible offer per pair, yielding 12 observations. An empty pair becomes unavailable with null prices. A lower Pricewatch listing can win with `verification: "Pricewatch-listed"`; the dashboard labels it as a listing that needs retailer confirmation.

Candidate input is a JSON object with `observed_at` (ISO timestamp), `fx_eur_pln`, `fx_source_url`, `fx_checked_at`, and `offers`. Each offer needs the exact `model`, `country`, `retailer`, `retailer_country`, local `original_currency` and `original_price`, `vat_included: true`, `orderable: true`, `checked_at`, `verification` (`retailer-confirmed` or `Pricewatch-listed`), and a direct retailer `url`. Pricewatch-listed offers also need `comparison_url`. A claim must be supported by the checked source; the script cannot independently inspect a web page or prove market-wide coverage. Any uncertain lower listing must be investigated before selection rather than omitted from the input.

Run `node --test scripts/select-lowest.test.mjs` and then `node scripts/select-lowest.mjs candidate-batch.json --history data/price-history.json`. The command appends 12 observations to the existing array. Review the diff and commit the history. Current dashboard prices expire after two hours; historical chart points only combine country observations checked within two hours of one another.
