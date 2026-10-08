import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../data/products.json',import.meta.url)));

async function boot(history=[]){
  const nodes=new Map(), charts=[];
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',checked:true,innerHTML:'',textContent:'',hidden:false,dataset:{},addEventListener(){},scrollIntoView(){}});
    return nodes.get(id);
  };
  const countries=['Netherlands','Germany'].map(c=>({checked:true,dataset:{country:c}}));
  const ctx=vm.createContext({
    console,Intl,Date,URL,
    document:{
      getElementById:el,
      querySelectorAll:s=>s==='[data-country]:checked'||s==='[data-country]'?countries:[]
    },
    Chart:class{constructor(_el,config){charts.push(config)}destroy(){}},
    fetch:async url=>({ok:true,json:async()=>url.includes('products')?catalog:history})
  });
  vm.runInContext(source,ctx);
  await new Promise(setImmediate);
  return {ctx,el,charts};
}

test('newer evidence-gap row does not hide the latest verified shopping price',async()=>{
  const {ctx}=await boot();
  const older=new Date(Date.now()-30*60*1000).toISOString();
  const newer=new Date(Date.now()-5*60*1000).toISOString();
  vm.runInContext(`observations=[
    {model:'AU1003501',country:'Netherlands',timestamp:'${older}',available:true,price_eur:77.99,retailer:'bol.com'},
    {model:'AU1003501',country:'Netherlands',timestamp:'${newer}',available:false,price_eur:null,retailer:'No verified current offer found'}
  ]`,ctx);
  const price=vm.runInContext("latestPrice('AU1003501','Netherlands')",ctx);
  assert.equal(price.price_eur,77.99);
});

test('shopping chart keeps each country in a separate dataset',async()=>{
  const {ctx,charts}=await boot();
  const t1=new Date(Date.now()-60*60*1000).toISOString();
  const t2=new Date(Date.now()-30*60*1000).toISOString();
  vm.runInContext(`observations=[
    {model:'AU1003501',country:'Netherlands',timestamp:'${t1}',available:true,price_eur:77.99,retailer:'NL'},
    {model:'AU1003501',country:'Germany',timestamp:'${t2}',available:true,price_eur:89.99,retailer:'DE'}
  ]; renderChart()`,ctx);
  const datasets=charts.at(-1).data.datasets;
  assert.equal(datasets.length,2);
  const labels=Array.from(datasets,d=>d.label);
  assert.equal(labels.length,2);
  assert.ok(labels.every(x=>/Auronic/.test(x)));
  assert.ok(labels.some(x=>/Germany/.test(x)));
  assert.ok(labels.some(x=>/Netherlands/.test(x)));
  assert.ok(datasets.every(d=>new Set(d.data.map(p=>p.country)).size===1));
});

test('shopping history never emits a clickable unsafe URL scheme',async()=>{
  const {ctx,el}=await boot();
  const now=new Date().toISOString();
  vm.runInContext(`observations=[
    {model:'AU1003501',country:'Netherlands',timestamp:'${now}',available:true,price_eur:77.99,retailer:'Unsafe',url:'javascript:alert(1)'}
  ]; renderTable()`,ctx);
  assert.doesNotMatch(el('priceRows').innerHTML,/javascript:/i);
  assert.doesNotMatch(el('priceRows').innerHTML,/href=/i);
});


test('shopping catalog still renders when price history is temporarily unavailable',async()=>{
  const nodes=new Map(),countries=['Netherlands','Germany'].map(c=>({checked:true,dataset:{country:c}}));
  const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:true,innerHTML:'',textContent:'',hidden:false,dataset:{},addEventListener(){},scrollIntoView(){}});return nodes.get(id)};
  const ctx=vm.createContext({
    console,Intl,Date,URL,
    document:{getElementById:el,querySelectorAll:s=>s==='[data-country]:checked'||s==='[data-country]'?countries:[]},
    Chart:class{destroy(){}},
    fetch:async url=>url.includes('products')
      ?{ok:true,status:200,json:async()=>catalog}
      :{ok:false,status:503,json:async()=>{throw Error('unavailable')}}
  });
  vm.runInContext(source.replace(/load\(\);\s*$/,''),ctx);
  await vm.runInContext('load()',ctx);
  assert.match(el('overview').innerHTML,/Auronic/);
  assert.match(el('tableCount').textContent,/History unavailable/i);
  assert.match(el('lastUpdated').textContent,/History unavailable/i);
});


test('shopping chart labels remain unique when multiple products share a country',async()=>{
  const {ctx,charts}=await boot();
  const now=new Date().toISOString();
  vm.runInContext(`catalog=[
    {model:'A',name:'Product A',category:'Other',enabled:true},
    {model:'B',name:'Product B',category:'Other',enabled:true}
  ]; observations=[
    {model:'A',country:'Netherlands',timestamp:'${now}',available:true,price_eur:10,retailer:'NL A'},
    {model:'B',country:'Netherlands',timestamp:'${now}',available:true,price_eur:20,retailer:'NL B'}
  ]; renderChart()`,ctx);
  const labels=Array.from(charts.at(-1).data.datasets,d=>d.label);
  assert.equal(new Set(labels).size,labels.length);
  assert.ok(labels.some(x=>/Product A/.test(x)));
  assert.ok(labels.some(x=>/Product B/.test(x)));
});
