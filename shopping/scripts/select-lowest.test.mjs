import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLowest } from './select-lowest.mjs';

const now=new Date().toISOString();
const product={model:'AU1003501',category:'Home & Living'};
const offer=(overrides={})=>({
  model:'AU1003501',
  country:'Netherlands',
  retailer:'Local seller',
  retailer_country:'Netherlands',
  original_currency:'EUR',
  original_price:79,
  vat_included:true,
  orderable:true,
  checked_at:now,
  evidence_type:'live-page',
  source_timestamp_status:'not-displayed',
  verification:'retailer-confirmed',
  url:'https://shop.example/AU1003501',
  ...overrides
});

test('shopping selector rejects duplicate exact model identifiers',()=>{
  assert.throws(()=>selectLowest({observed_at:now,offers:[]},[product,product]),/unique exact model/i);
});

test('shopping selector preserves preorder state in the selected observation',()=>{
  const rows=selectLowest({observed_at:now,offers:[offer({availability_status:'preorder',status_note:'Preorder; ships later.'})]},[product]);
  const row=rows.find(r=>r.country==='Netherlands');
  assert.equal(row.availability_status,'preorder');
});

test('shopping selector records a specific audit note for missing verified offers',()=>{
  const rows=selectLowest({observed_at:now,offers:[]},[product]);
  const row=rows.find(r=>r.country==='Germany');
  assert.equal(row.available,false);
  assert.match(row.status_note,/No fresh exact-product local offer established/i);
});


test('shopping selector requires a named retailer and known verification mode',()=>{
  assert.throws(()=>selectLowest({observed_at:now,offers:[offer({retailer:''})]},[product]),/Missing retailer/i);
  assert.throws(()=>selectLowest({observed_at:now,offers:[offer({verification:'mystery-verification'})]},[product]),/Unknown verification/i);
});

test('shopping selector rejects a future observation timestamp',()=>{
  const future=new Date(Date.now()+5*60*1000).toISOString();
  assert.throws(()=>selectLowest({observed_at:future,offers:[]},[product]),/Invalid batch/i);
});


test('shopping comparison offers preserve audit metadata and reject explicit non-orderability',()=>{
  const comparison=offer({
    verification:'Comparison-listed; retailer checkout price not independently confirmed',
    comparison_url:'https://comparison.example/AU1003501',
    comparison_seller:'Local comparison seller',
    comparison_seller_country:'Netherlands',
    url:'javascript:alert(1)',
    orderable:null
  });
  const rows=selectLowest({observed_at:now,offers:[comparison]},[product]);
  const row=rows.find(r=>r.country==='Netherlands');
  assert.equal(row.comparison_url,'https://comparison.example/AU1003501');
  assert.equal(row.comparison_seller,'Local comparison seller');
  assert.equal(row.comparison_seller_country,'Netherlands');
  assert.equal(row.url,'https://comparison.example/AU1003501');
  assert.throws(()=>selectLowest({observed_at:now,offers:[{...comparison,orderable:false}]},[product]),/Orderability unverified/i);
});
