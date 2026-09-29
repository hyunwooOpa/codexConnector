import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLowest } from './select-lowest.mjs';

const now = new Date().toISOString();
const offer = (overrides = {}) => ({ model: '34B2U5900C', country: 'Netherlands', retailer: 'Local shop', retailer_country: 'Netherlands', original_currency: 'EUR', original_price: 650, vat_included: true, orderable: true, checked_at: now, verification: 'retailer-confirmed', url: 'https://shop.example/34B2U5900C', ...overrides });
const batch = offers => ({ observed_at: now, fx_eur_pln: 4.2, fx_source_url: 'https://fx.example/rate', fx_checked_at: now, offers });

test('selects cheaper Pricewatch listing even when a direct retailer is listed first', () => {
  const rows = selectLowest(batch([offer(), offer({ retailer: 'Local comparison seller', original_price: 523.93, verification: 'Pricewatch-listed', comparison_url: 'https://tweakers.net/pricewatch/2376176/', comparison_seller: 'Local comparison seller', comparison_seller_country: 'Netherlands', url: 'https://local.example/model' })]));
  assert.equal(rows.length, 12);
  assert.equal(rows.find(x => x.model === '34B2U5900C' && x.country === 'Netherlands').price_eur, 523.93);
  assert.equal(rows.find(x => x.model === '34B2U5900C' && x.country === 'Netherlands').verification, 'Pricewatch-listed');
  assert.equal(rows.find(x => x.model === '34B2U5900C' && x.country === 'Germany').available, false);
});

test('rejects Belgian shop assigned to Netherlands, unverified VAT, stale checks and variant mismatch', () => {
  assert.throws(() => selectLowest(batch([offer({ retailer_country: 'Belgium' })])), /country mismatch/);
  assert.throws(() => selectLowest(batch([offer({ vat_included: false })])), /VAT\/orderability/);
  assert.throws(() => selectLowest(batch([offer({ checked_at: '2020-01-01T00:00:00Z' })])), /Stale/);
  assert.throws(() => selectLowest(batch([offer({ model: '34B2U5900C-01' })])), /Unknown model/);
  assert.throws(() => selectLowest(batch([offer({ verification: 'Pricewatch-listed', comparison_url: 'https://tweakers.net/pricewatch/2376176/', comparison_seller: 'Redable.be', comparison_seller_country: 'Belgium' })])), /Comparison seller country mismatch/);
});

test('converts Polish local price using checked FX and retains all 12 pairs', () => {
  const rows = selectLowest(batch([offer({ country: 'Poland', retailer_country: 'Poland', original_currency: 'PLN', original_price: 2100 })]));
  const pl = rows.find(x => x.model === '34B2U5900C' && x.country === 'Poland');
  assert.equal(pl.price_eur, 500);
  assert.equal(pl.fx_eur_pln, 4.2);
  assert.equal(rows.filter(x => x.available).length, 1);
});

test('keeps a lower local comparison price when checkout and stock are not independently readable', () => {
  const rows = selectLowest(batch([offer(), offer({ retailer: 'Local comparison seller', original_price: 523.93, verification: 'Comparison-listed; retailer checkout price not independently confirmed', comparison_url: 'https://comparison.example/exact-model', comparison_seller: 'Local comparison seller', comparison_seller_country: 'Netherlands', url: null, orderable: null })]));
  const nl = rows.find(x => x.model === '34B2U5900C' && x.country === 'Netherlands');
  assert.equal(nl.price_eur, 523.93);
  assert.equal(nl.url, 'https://comparison.example/exact-model');
  assert.match(nl.status_note, /checkout not independently confirmed/);
});
