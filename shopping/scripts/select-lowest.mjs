import { readFileSync } from 'node:fs';
export const PRODUCTS=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
export const COUNTRIES=['Netherlands','Germany'];
const MAX_AGE_MS=2*60*60*1000;
const validUrl=v=>{try{return ['http:','https:'].includes(new URL(v).protocol)}catch{return false}};
export function selectLowest(batch,products=PRODUCTS){
 if(!Array.isArray(products))throw Error('Product catalog must be an array');
 const active=products.filter(p=>p.enabled!==false),models=active.map(p=>p.model),now=Date.parse(batch.observed_at);
 if(models.some(m=>typeof m!=='string'||!m.trim())||new Set(models).size!==models.length)throw Error('Catalog requires unique exact model identifiers');
 if(!Number.isFinite(now)||now>Date.now()+60000||!Array.isArray(batch.offers))throw Error('Invalid batch');
 const offers=batch.offers.map(o=>{
  if(!models.includes(o.model)||!COUNTRIES.includes(o.country))throw Error('Unknown model/country');
  if(!o.retailer)throw Error('Missing retailer');
  if(o.retailer_country!==o.country||o.original_currency!=='EUR'||o.vat_included!==true)throw Error('Market/currency/VAT mismatch');
  if(!Number.isFinite(o.original_price)||o.original_price<=0)throw Error('Invalid price');
  if(!['live-page','user-screenshot'].includes(o.evidence_type)||!['dated','not-displayed'].includes(o.source_timestamp_status))throw Error('Insufficient evidence');
  const checked=Date.parse(o.checked_at);if(!Number.isFinite(checked)||now-checked>MAX_AGE_MS||checked>now+60000)throw Error('Stale check');
  if(o.source_timestamp_status==='dated'){const t=Date.parse(o.source_price_at);if(!Number.isFinite(t)||now-t>MAX_AGE_MS||t>now+60000)throw Error('Stale source price')}
  const listed=/^(Pricewatch|Comparison)-listed/.test(o.verification||'');
  if(!listed&&o.orderable!==true)throw Error('Orderability unverified');
  if(listed&&(!validUrl(o.comparison_url)||!o.comparison_seller||o.comparison_seller_country!==o.country))throw Error('Invalid comparison evidence');
  if(!validUrl(o.url)&&!validUrl(o.comparison_url))throw Error('Missing source URL');
  return {...o,price_eur:o.original_price};
 });
 return active.flatMap(p=>COUNTRIES.map(country=>{const best=offers.filter(o=>o.model===p.model&&o.country===country).sort((a,b)=>a.price_eur-b.price_eur)[0];if(!best)return {timestamp:batch.observed_at,model:p.model,category:p.category,country,retailer:'No verified current offer found',original_currency:'EUR',original_price:null,price_eur:null,available:false,url:null,evidence_type:'live-page',source_timestamp_status:'not-displayed',status_note:'No fresh exact-product local offer established in this run.'};return {timestamp:batch.observed_at,model:p.model,category:p.category,country,retailer:best.retailer,original_currency:'EUR',original_price:best.original_price,price_eur:best.price_eur,available:true,url:best.url||best.comparison_url,verification:best.verification,evidence_type:best.evidence_type,source_timestamp_status:best.source_timestamp_status,...(best.source_price_at?{source_price_at:best.source_price_at}:{}),source_checked_at:best.checked_at,...(best.availability_status?{availability_status:best.availability_status}:{}),...(best.status_note?{status_note:best.status_note}:{})}}));
}
