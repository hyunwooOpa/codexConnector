import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../data/products.json',import.meta.url)));
async function boot(storage=new Map()){
 const nodes=new Map();
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:true,innerHTML:'',textContent:'',hidden:false,dataset:{},addEventListener(){},scrollIntoView(){},reset(){},querySelectorAll(){return []},querySelector(){return null},appendChild(){}});return nodes.get(id)};
 const countries=['Germany','Netherlands','Poland'].map(c=>({checked:true,dataset:{country:c}}));
 const ctx=vm.createContext({console,Intl,Date,URL,Blob,document:{getElementById:el,querySelectorAll:s=>s==='[data-country]:checked'||s==='[data-country]'?countries:[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Chart:class{destroy(){}},fetch:async url=>({ok:true,json:async()=>url.includes('products')?catalog:[],text:async()=>JSON.stringify(url.includes('products')?catalog:[])})});
 vm.runInContext(source,ctx);await new Promise(setImmediate);
 return {el,ctx,storage};
}
test('new component draft renders, persists, filters and never appears as a checked price',async()=>{
 const {el,ctx,storage}=await boot();
 el('newModel').value='TEST-RAM-2X16';el('newCategory').value='Memory';el('newName').value='32 GB memory kit';el('newStatus').value='Shortlisted';el('newTarget').value='99';el('newNotes').value='<script>not code</script>';
 el('productForm').onsubmit({preventDefault(){}});
 assert.match(el('overview').innerHTML,/32 GB memory kit/);
 assert.match(el('overview').innerHTML,/Device-only draft/);
 assert.match(el('overview').innerHTML,/&lt;script&gt;/);
 assert.equal(el('draftCount').textContent,1);
 assert.match(el('overview').innerHTML,/Target €99.00/);
 el('category').value='CPU';vm.runInContext('render()',ctx);assert.match(el('overview').innerHTML,/No products match/);
 const reload=await boot(storage);assert.match(reload.el('overview').innerHTML,/32 GB memory kit/);
 assert.equal(reload.el('trackedCount').textContent,catalog.filter(p=>p.enabled!==false).length);
});

test('role filter separates primary products from competitors',async()=>{
 const {el,ctx}=await boot();
 el('roleFilter').value='competitor';vm.runInContext('render()',ctx);
 assert.match(el('overview').innerHTML,/Competitor/);
 assert.doesNotMatch(el('overview').innerHTML,/<h3>Philips 34B2U5900C/);
 el('roleFilter').value='primary';vm.runInContext('render()',ctx);
 assert.match(el('overview').innerHTML,/<h3>Philips 34B2U5900C/);
 assert.doesNotMatch(el('overview').innerHTML,/Samsung ViewFinity/);
});


test('recent verified price survives a newer evidence-gap observation',async()=>{
 const {ctx}=await boot();
 const now=Date.now();
 const older=new Date(now-30*60*1000).toISOString();
 const newer=new Date(now-5*60*1000).toISOString();
 vm.runInContext(`observations=[
  {model:'P3426WEV',country:'Netherlands',timestamp:'${older}',available:true,price_eur:583.70,retailer:'Dell Netherlands'},
  {model:'P3426WEV',country:'Netherlands',timestamp:'${newer}',available:false,price_eur:null,retailer:'No verified local orderable offer found'}
 ]`,ctx);
 const price=vm.runInContext("latestPrice('P3426WEV','Netherlands')",ctx);
 assert.equal(price.price_eur,583.70);
 assert.equal(price.retailer,'Dell Netherlands');
});

test('stale verified price remains visible and is marked stale',async()=>{
 const {ctx}=await boot();
 const old=new Date(Date.now()-11*60*60*1000).toISOString();
 vm.runInContext(`observations=[
  {model:'P3426WEV',country:'Germany',timestamp:'${old}',available:true,price_eur:574.05,retailer:'Dell Germany'}
 ]`,ctx);
 const price=vm.runInContext("latestPrice('P3426WEV','Germany')",ctx);
 const isStale=vm.runInContext("stale(latestPrice('P3426WEV','Germany'))",ctx);
 assert.equal(price.price_eur,574.05);
 assert.equal(isStale,true);
});


test('published products removed locally export as disabled instead of disappearing',async()=>{
  const {ctx}=await boot();
  vm.runInContext(`shopping['P3426WEV']={removed:true,catalog:{model:'P3426WEV',name:'Dell Pro P3426WEV',category:'Monitor',enabled:true}};`,ctx);
  const exported=vm.runInContext("catalogForExport()",ctx);
  const item=exported.find(p=>p.model==='P3426WEV');
  assert.ok(item);
  assert.equal(item.enabled,false);
});


test('manual observations are labeled unverified instead of lowest checked price',async()=>{
  const {ctx,el}=await boot();
  const now=new Date().toISOString();
  vm.runInContext(`observations=[
    {model:'P3426WEV',country:'Netherlands',timestamp:'${now}',available:true,price_eur:555,retailer:'Manual entry',verification:'manual-user-entry'}
  ]; renderCards()`,ctx);
  assert.match(el('overview').innerHTML,/Manual current price · unverified/);
  assert.doesNotMatch(el('overview').innerHTML,/Lowest checked price/);
});

test('last checked timestamp ignores newer manual-only observations',async()=>{
  const {ctx}=await boot();
  const checked=new Date(Date.now()-60*60*1000).toISOString();
  const manual=new Date().toISOString();
  vm.runInContext(`publishedObservations=[
    {model:'P3426WEV',country:'Netherlands',timestamp:'${checked}',available:true,price_eur:580}
  ]; manualObservations=[
    {model:'P3426WEV',country:'Netherlands',timestamp:'${manual}',available:true,price_eur:550,verification:'manual-user-entry'}
  ]; refreshObservations()`,ctx);
  const ts=vm.runInContext('lastCheckedAt()',ctx);
  assert.equal(ts,Date.parse(checked));
});
