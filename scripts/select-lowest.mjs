import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MODELS = ['34B2U5900C', '34B2U6603CH', '34B2U5600C', '34E1C5600AM'];
export const COUNTRIES = ['Germany', 'Netherlands', 'Poland'];
const CURRENCY = { Germany: 'EUR', Netherlands: 'EUR', Poland: 'PLN' };
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function validUrl(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function checkedOffer(offer, now, fx) {
  if (!MODELS.includes(offer.model) || !COUNTRIES.includes(offer.country)) throw new Error(`Unknown model/country: ${offer.model}/${offer.country}`);
  if (offer.retailer_country !== offer.country) throw new Error(`Retailer country mismatch: ${offer.model}/${offer.country} at ${offer.retailer}`);
  if (!offer.retailer || !validUrl(offer.url)) throw new Error(`Missing retailer or direct offer URL: ${offer.model}/${offer.country}`);
  if (offer.original_currency !== CURRENCY[offer.country]) throw new Error(`Wrong local currency: ${offer.model}/${offer.country}`);
  if (!Number.isFinite(offer.original_price) || offer.original_price <= 0) throw new Error(`Invalid price: ${offer.model}/${offer.country}`);
  if (offer.vat_included !== true || offer.orderable !== true) throw new Error(`VAT/orderability unverified: ${offer.model}/${offer.country} at ${offer.retailer}`);
  const seen = Date.parse(offer.checked_at);
  if (!Number.isFinite(seen) || seen > now + 60_000 || now - seen > MAX_AGE_MS) throw new Error(`Stale or invalid check: ${offer.model}/${offer.country} at ${offer.retailer}`);
  const listed = offer.verification?.startsWith('Pricewatch-listed');
  if (offer.verification !== 'retailer-confirmed' && !listed) throw new Error(`Unknown verification: ${offer.model}/${offer.country}`);
  if (listed && !validUrl(offer.comparison_url)) throw new Error(`Missing comparison URL: ${offer.model}/${offer.country}`);
  const price_eur = offer.country === 'Poland' ? Math.round(offer.original_price / fx * 100) / 100 : offer.original_price;
  return { ...offer, price_eur };
}

// All offers are checked before selecting any winner. An invalid lower listing must be
// investigated, rather than silently ignored in favour of a higher retailer price.
export function selectLowest(batch) {
  const now = Date.parse(batch.observed_at);
  if (!Number.isFinite(now) || now > Date.now() + 60_000) throw new Error('Invalid observation timestamp');
  const fx = batch.fx_eur_pln;
  if (!Number.isFinite(fx) || fx <= 0 || !validUrl(batch.fx_source_url) || !Number.isFinite(Date.parse(batch.fx_checked_at)) || Math.abs(now - Date.parse(batch.fx_checked_at)) > MAX_AGE_MS) throw new Error('Current EUR/PLN rate and source are required');
  if (!Array.isArray(batch.offers)) throw new Error('Expected offers array');
  const offers = batch.offers.map(o => checkedOffer(o, now, fx));
  return MODELS.flatMap(model => COUNTRIES.map(country => {
    const matches = offers.filter(o => o.model === model && o.country === country).sort((a, b) => a.price_eur - b.price_eur);
    const best = matches[0];
    if (!best) return { timestamp: batch.observed_at, model, country, retailer: 'No verified local orderable offer found', original_currency: CURRENCY[country], original_price: null, price_eur: null, available: false, url: null, ...(country === 'Poland' ? { fx_eur_pln: fx } : {}) };
    return { timestamp: batch.observed_at, model, country, retailer: best.retailer, original_currency: best.original_currency, original_price: best.original_price, price_eur: best.price_eur, available: true, url: best.url, verification: best.verification, ...(best.comparison_url ? { comparison_url: best.comparison_url } : {}), ...(country === 'Poland' ? { fx_eur_pln: fx } : {}) };
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, flag, historyPath] = process.argv.slice(2);
  if (!input || (flag && flag !== '--history') || (flag && !historyPath)) {
    console.error('Usage: node scripts/select-lowest.mjs candidate-batch.json [--history data/price-history.json]');
    process.exitCode = 2;
  } else {
    try {
      const observations = selectLowest(JSON.parse(await readFile(input, 'utf8')));
      if (historyPath) {
        const previous = JSON.parse(await readFile(historyPath, 'utf8'));
        if (!Array.isArray(previous)) throw new Error('History must be an array');
        await writeFile(historyPath, JSON.stringify([...previous, ...observations], null, 2) + '\n');
      } else console.log(JSON.stringify(observations, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
