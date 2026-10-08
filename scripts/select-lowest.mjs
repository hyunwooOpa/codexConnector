import { readFileSync } from 'node:fs';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCTS = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
export const MODELS = PRODUCTS.filter(p => p.enabled !== false).map(p => p.model);
export const COUNTRIES = ['Germany', 'Netherlands', 'Poland'];
const CURRENCY = { Germany: 'EUR', Netherlands: 'EUR', Poland: 'PLN' };
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function validUrl(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function checkedOffer(offer, now, fx, models) {
  if (!models.includes(offer.model) || !COUNTRIES.includes(offer.country)) throw new Error(`Unknown model/country: ${offer.model}/${offer.country}`);
  if (offer.retailer_country !== offer.country) throw new Error(`Retailer country mismatch: ${offer.model}/${offer.country} at ${offer.retailer}`);
  if (!offer.retailer) throw new Error(`Missing retailer: ${offer.model}/${offer.country}`);
  if (offer.original_currency !== CURRENCY[offer.country]) throw new Error(`Wrong local currency: ${offer.model}/${offer.country}`);
  if (!Number.isFinite(offer.original_price) || offer.original_price <= 0) throw new Error(`Invalid price: ${offer.model}/${offer.country}`);
  const listed = /^(Pricewatch|Comparison)-listed/.test(offer.verification || '');
  if (offer.vat_included !== true || (!listed && offer.orderable !== true) || (listed && offer.orderable === false)) throw new Error(`VAT/orderability unverified: ${offer.model}/${offer.country} at ${offer.retailer}`);
  if (!['live-page', 'user-screenshot'].includes(offer.evidence_type)) throw new Error('Missing live price evidence type');
  if (!['dated', 'not-displayed'].includes(offer.source_timestamp_status)) throw new Error('Missing source timestamp status');
  if (offer.source_timestamp_status === 'dated' || offer.source_price_at != null) {
    const sourceTime = Date.parse(offer.source_price_at);
    if (!Number.isFinite(sourceTime) || sourceTime > now + 60_000 || now - sourceTime > MAX_AGE_MS) throw new Error('Stale or invalid source price timestamp');
  }
  const seen = Date.parse(offer.checked_at);
  if (!Number.isFinite(seen) || seen > now + 60_000 || now - seen > MAX_AGE_MS) throw new Error(`Stale or invalid check: ${offer.model}/${offer.country} at ${offer.retailer}`);
  if (offer.verification !== 'retailer-confirmed' && !listed) throw new Error(`Unknown verification: ${offer.model}/${offer.country}`);
  if (listed && !validUrl(offer.comparison_url)) throw new Error(`Missing comparison URL: ${offer.model}/${offer.country}`);
  if (!validUrl(offer.url) && !(listed && validUrl(offer.comparison_url))) throw new Error(`Missing offer or comparison URL: ${offer.model}/${offer.country}`);
  if (listed && (!offer.comparison_seller || offer.comparison_seller_country !== offer.country)) throw new Error(`Comparison seller country mismatch: ${offer.model}/${offer.country}`);
  const price_eur = offer.country === 'Poland' ? Math.round(offer.original_price / fx * 100) / 100 : offer.original_price;
  return { ...offer, price_eur };
}

export function selectLowest(batch, products = PRODUCTS) {
  if (!Array.isArray(products)) throw new Error('Product catalog must be an array');
  const active = products.filter(p => p.enabled !== false);
  const models = active.map(p => p.model);
  if (models.some(m => typeof m !== 'string' || !m.trim()) || new Set(models).size !== models.length) throw new Error('Catalog requires unique exact model identifiers');
  const now = Date.parse(batch.observed_at);
  if (!Number.isFinite(now) || now > Date.now() + 60_000) throw new Error('Invalid observation timestamp');
  const fx = batch.fx_eur_pln;
  if (!Number.isFinite(fx) || fx <= 0 || !validUrl(batch.fx_source_url) || !Number.isFinite(Date.parse(batch.fx_checked_at)) || Math.abs(now - Date.parse(batch.fx_checked_at)) > MAX_AGE_MS) throw new Error('Current EUR/PLN rate and source are required');
  if (!Array.isArray(batch.offers)) throw new Error('Expected offers array');
  const offers = batch.offers.map(o => checkedOffer(o, now, fx, models));
  return models.flatMap(model => COUNTRIES.map(country => {
    const matches = offers.filter(o => o.model === model && o.country === country).sort((a, b) => a.price_eur - b.price_eur);
    const best = matches[0];
    const product = active.find(p => p.model === model);
    const identity = { category: product.category || "Other", tracking_role: product.tracking_role || 'primary', ...(Array.isArray(product.competitor_of) && product.competitor_of.length ? { competitor_of: product.competitor_of } : {}) };
    if (!best) return { timestamp: batch.observed_at, model, ...identity, country, retailer: 'No verified local orderable offer found', original_currency: CURRENCY[country], original_price: null, price_eur: null, available: false, url: null, evidence_type: 'live-page', source_timestamp_status: 'not-displayed', status_note: 'No fresh exact-product local offer established in this run.', ...(country === 'Poland' ? { fx_eur_pln: fx } : {}) };
    return { timestamp: batch.observed_at, model, ...identity, country, retailer: best.retailer, original_currency: best.original_currency, original_price: best.original_price, price_eur: best.price_eur, available: true, url: validUrl(best.url) ? best.url : best.comparison_url, verification: best.verification, evidence_type: best.evidence_type, source_timestamp_status: best.source_timestamp_status, ...(best.source_price_at ? { source_price_at: best.source_price_at } : {}), source_checked_at: best.checked_at, ...(best.comparison_url ? { comparison_url: best.comparison_url, comparison_seller: best.comparison_seller, comparison_seller_country: best.comparison_seller_country } : {}), ...(best.availability_status ? { availability_status: best.availability_status } : {}), ...(best.status_note ? { status_note: best.status_note } : best.orderable !== true ? { status_note: 'Comparison listing only; retailer stock and checkout not independently confirmed.' } : {}), ...(country === 'Poland' ? { fx_eur_pln: fx } : {}) };
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
        if (observations.length && previous.some(x => x.timestamp === observations[0].timestamp && MODELS.includes(x.model) && COUNTRIES.includes(x.country))) throw new Error('Observation timestamp already exists in history; use a fresh check timestamp');
        const serialized = JSON.stringify([...previous, ...observations], null, 2) + '\n';
        JSON.parse(serialized);
        const tempPath = historyPath + '.tmp';
        try {
          await writeFile(tempPath, serialized);
          JSON.parse(await readFile(tempPath, 'utf8'));
          await rename(tempPath, historyPath);
        } finally { await rm(tempPath, { force: true }).catch(() => {}); }
      } else console.log(JSON.stringify(observations, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
