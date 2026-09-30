import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('../data/products.json',import.meta.url)));
async function boot(storage=new Map()){
 const nodes=new Map();
 const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:true,innerHTML:'',textContent:'',hidden:false,dataset:{},addEventListener(){},scrollIntoView(){},reset(){}});return nodes.get(id)};
 const countries=['Germany','Netherlands','Poland','Belgium'].map(c=>({checked:true,dataset:{country:c}}));
 const ctx=vm.createContext({console,Intl,Date,URL,Blob,document:{getElementById:el,querySelectorAll:s=>s==='[data-country]:checked'||s==='[data-country]'?countries:[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Chart:class{destroy(){}},fetch:async url=>({ok:true,json:async()=>url.includes('products')?catalog:[]})});
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
 el('category').value='GPU';vm.runInContext('render()',ctx);assert.match(el('overview').innerHTML,/No products match/);
 const reload=await boot(storage);assert.match(reload.el('overview').innerHTML,/32 GB memory kit/);
 assert.equal(reload.el('trackedCount').textContent,10);
});

test('role filter separates primary products from competitors',async()=>{
 const {el,ctx}=await boot();
 el('roleFilter').value='competitor';vm.runInContext('render()',ctx);
 assert.match(el('overview').innerHTML,/Competitor/);
 assert.doesNotMatch(el('overview').innerHTML,/Philips 34B2U5900C/);
 el('roleFilter').value='primary';vm.runInContext('render()',ctx);
 assert.match(el('overview').innerHTML,/Philips 34B2U5900C/);
 assert.doesNotMatch(el('overview').innerHTML,/Samsung ViewFinity/);
});
