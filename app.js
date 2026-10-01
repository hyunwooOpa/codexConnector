const COUNTRIES=['Germany','Netherlands','Poland','Belgium'];
const CATEGORIES=['Monitor','GPU','Memory','CPU','Motherboard','Storage','Power supply','Case','Cooling','Keyboard','Mouse','Controller','Webcam','Audio','Networking','Accessories','Other'];
const FLAGS={Germany:'🇩🇪',Netherlands:'🇳🇱',Poland:'🇵🇱',Belgium:'🇧🇪'};
const KEY='pcUpgradeDraftsV1', STATE='pcUpgradeShoppingV1', MAX_AGE=10*3600000;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur=v=>v==null?'—':new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(v);
const date=v=>new Date(v).toLocaleString('en-GB',{timeZone:'Europe/Amsterdam',dateStyle:'medium',timeStyle:'short'});
const safeUrl=v=>/^https?:\/\//i.test(v||'')?v:null;
function saved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let catalog=[],observations=[],drafts=saved(KEY,[]),shopping=saved(STATE,{}),chart;
let days='30';
function products(){return [...catalog,...drafts.filter(d=>!catalog.some(p=>p.model===d.model))].filter(p=>!shopping[p.model]?.removed).map(p=>({...p,...(shopping[p.model]?.catalog||{})}))}
function metadata(model){return products().find(p=>p.model===model)||{model,name:model,category:'Other'}}
function localState(p){return shopping[p.model]||{status:'Planned',target:p.target_price_eur??null,notes:''}}
function isDraft(p){return !catalog.some(x=>x.model===p.model)}
function visibleProducts(){const q=$('search').value.toLowerCase(),category=$('category').value,status=$('shoppingFilter').value,role=$('roleFilter').value;return products().filter(p=>(!category||p.category===category)&&(!role||((p.tracking_role||'primary')===role))&&(!status||localState(p).status===status)&&(!q||[p.model,p.name,p.brand,p.variant,p.competitor_reason].join(' ').toLowerCase().includes(q)))}
function latest(model,country){return observations.filter(o=>o.model===model&&o.country===country&&!o.invalidated_observation&&Date.parse(o.timestamp)<=Date.now()+60000).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0]}
function eligible(o){return o&&o.available!==false&&Number.isFinite(o.price_eur)}
function stale(o){return o&&Number.isFinite(Date.parse(o.timestamp))&&Date.now()-Date.parse(o.timestamp)>MAX_AGE}
function selectedCountries(){return [...document.querySelectorAll('[data-country]:checked')].map(x=>x.dataset.country)}
function best(model){return selectedCountries().map(c=>latest(model,c)).filter(eligible).sort((a,b)=>a.price_eur-b.price_eur)[0]}
function manualPrice(p){const s=localState(p),value=s.current_price_eur??p.current_price_eur??p.price_eur??p.price;return Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null}
function currentOffer(p){const tracked=best(p.model);if(tracked)return tracked;const price=manualPrice(p);return price==null?null:{price_eur:price,retailer:'Manual current price',country:'',verification:'manual'}}

function color(model){let h=0;for(const c of model)h=(h*31+c.charCodeAt(0))>>>0;return `hsl(${h%360} 75% 65%)`}
function renderCards(){const shown=visibleProducts();$('overview').innerHTML=shown.map(p=>{const b=currentOffer(p),s=localState(p),draft=isDraft(p),role=p.tracking_role||'primary',links=(p.competitor_of||[]).map(id=>metadata(id).name||id);return `<article class="monitor-card"><span class="category-tag">${role==='competitor'?'Competitor':'Primary'} · ${esc(p.category)} · ${esc(s.status)}</span><h3>${esc(p.name||p.model)}</h3><p class="muted">${esc(p.model)}${p.variant?' · '+esc(p.variant):''}</p>${role==='competitor'?`<p class="muted">Compared with: ${esc(links.join(', ')||'selected primary products')}${p.competitor_reason?' · '+esc(p.competitor_reason):''}</p>`:''}<span class="price-badge">${draft?(manualPrice(p)!=null?'Manual current price':'Device-only draft'):p.enabled===false?'Tracking paused':b?(`${/listed/.test(b.verification)?'Lowest listed price':'Lowest checked price'}${stale(b)?' · stale':''}`):'Awaiting price check'}</span><div class="price">${eur(b?.price_eur)}</div><p>${b?esc(b.retailer)+(b.country?' · '+(FLAGS[b.country]||b.country):''):draft?'Enter a current price or publish the catalog to start scheduled checks.':'No current price in selected countries.'}</p>${b?`<p class="muted">${esc(date(b.timestamp))}${b.availability_status==='preorder'?' · Preorder':''}</p>`:''}${s.target!=null?`<p class="target">Target ${eur(s.target)}${b?(b.price_eur<=s.target?' · Target reached':' · '+eur(b.price_eur-s.target)+' above target'):''}</p>`:''}<div class="country-list">${selectedCountries().map(c=>{const o=latest(p.model,c);return `<div class="country-row"><span>${FLAGS[c]} ${c}</span><strong>${eligible(o)?eur(o.price_eur):'—'}</strong></div>`}).join('')}</div><button class="card-btn" data-details="${esc(p.model)}">Price history & sources →</button>${s.notes?`<details><summary>Shopping notes</summary>${esc(s.notes)}</details>`:''}<button class="card-btn" data-edit="${esc(p.model)}">Shopping details</button>${draft?`<button class="card-btn" data-remove="${esc(p.model)}">Remove draft</button>`:''}</article>`}).join('')||'<div class="panel empty">No products match these filters. Add an exact product below.</div>';
 document.querySelectorAll('[data-remove]').forEach(b=>b.textContent='Remove from list');
 document.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>{$('tableModel').value=b.dataset.details;renderTable();$('prices').scrollIntoView()});
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editProduct(b.dataset.edit));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeProduct(b.dataset.remove));
 document.querySelectorAll('#overview article.monitor-card').forEach(card=>{
  if(card.querySelector('[data-remove]'))return;
  const edit=card.querySelector('[data-edit]');
  if(!edit)return;
  const button=document.createElement('button');
  button.className='card-btn remove-btn';
  button.dataset.remove=edit.dataset.edit;
  button.textContent='Remove from list';
  button.onclick=()=>removeProduct(button.dataset.remove);
  card.appendChild(button);
 });
 // Keep the delete action tied to the rendered product index as a fallback for
 // catalog cards whose edit metadata is unavailable.
 [...$('overview').querySelectorAll('article.monitor-card')].forEach((card,index)=>{
  if(card.querySelector('[data-remove]')||!shown[index])return;
  const button=document.createElement('button');
  button.className='card-btn remove-btn';
  button.dataset.remove=shown[index].model;
  button.textContent='Remove from list';
  button.addEventListener('click',()=>removeProduct(shown[index].model));
  card.appendChild(button);
 });
 $('trackedCount').textContent=catalog.filter(p=>p.enabled!==false).length;
 $('draftCount').textContent=products().filter(isDraft).length;
 const reached=shown.filter(p=>{const t=localState(p).target,b=best(p.model);return t!=null&&b&&b.price_eur<=t});$('targetCount').textContent=reached.length;
}
function renderChart(){const cs=selectedCountries(),cutoff=days==='all'?0:Date.now()-Number(days)*86400000;
 const datasets=visibleProducts().map(p=>{const current=new Map(),points=[];const rows=observations.filter(o=>o.model===p.model&&cs.includes(o.country)&&!o.invalidated_observation&&Date.parse(o.timestamp)<=Date.now()+60000).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));for(const o of rows){const t=Date.parse(o.timestamp);current.set(o.country,o);if(t<cutoff)continue;const b=[...current.values()].filter(v=>v.available!==false&&Number.isFinite(v.price_eur)&&true).sort((a,b)=>a.price_eur-b.price_eur)[0];const point={x:t,y:b?.price_eur??null,retailer:b?.retailer,country:b?.country};if(points.at(-1)?.x===t)points[points.length-1]=point;else points.push(point)}return {label:p.name||p.model,data:points,borderColor:color(p.model),backgroundColor:color(p.model),pointRadius:3,tension:0,spanGaps:false}}).filter(d=>d.data.length);
 $('chartEmpty').hidden=datasets.length>0;if(chart)chart.destroy();if(typeof Chart==='undefined'){$('chartEmpty').hidden=false;$('chartEmpty').textContent='Chart could not load. Prices and history are available below.';return}chart=new Chart($('priceChart'),{type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,parsing:false,scales:{x:{type:'linear',ticks:{color:'#aebcd0',callback:v=>new Date(v).toLocaleDateString('en-GB',{timeZone:'Europe/Amsterdam',day:'2-digit',month:'short'})}},y:{ticks:{color:'#aebcd0',callback:v=>'€'+v}}},plugins:{legend:{labels:{color:'#f5f8fc'}},tooltip:{callbacks:{title:items=>date(items[0].raw.x),label:c=>`${c.dataset.label}: ${eur(c.raw.y)} · ${c.raw.country||''} · ${c.raw.retailer||''}`}}}}});
}
function renderTable(){const allowed=new Set(visibleProducts().map(p=>p.model)),model=$('tableModel').value,country=$('tableCountry').value;const rows=observations.filter(o=>allowed.has(o.model)&&(!model||o.model===model)&&(!country||o.country===country)).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));$('priceRows').innerHTML=rows.map(o=>{const invalid=!!o.invalidated_observation,url=safeUrl(o.comparison_url||o.url),p=metadata(o.model),role=p.tracking_role||'primary';const status=invalid?'Invalidated':o.available===false?'Price unknown':o.availability_status==='preorder'?'Preorder':/listed/.test(o.verification||'')?'Listed · checkout unconfirmed':'Retailer-confirmed at check';return `<tr><td>${esc(date(o.timestamp))}</td><td>${esc(p.name||o.model)}</td><td>${esc(p.category)}</td><td>${role==='competitor'?'Competitor':'Primary'}</td><td>${FLAGS[o.country]||''} ${esc(o.country)}</td><td>${!invalid&&o.original_price!=null?esc(o.original_price+' '+o.original_currency):'—'}</td><td>${invalid?'—':eur(o.price_eur)}</td><td>${esc(o.retailer)}</td><td>${status}<details><summary>Details</summary>${esc(o.correction_reason||o.status_note||'No additional delivery information.')}</details></td><td>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Source ↗</a>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="10">No observations match these filters.</td></tr>';$('tableCount').textContent=`${rows.length} of ${observations.length} observations`}
function renderOptions(){const old=$('tableModel').value;$('tableModel').innerHTML='<option value="">All products</option>'+products().map(p=>`<option value="${esc(p.model)}">${esc(p.name||p.model)}</option>`).join('');$('tableModel').value=old;}
function render(){renderCards();renderChart();renderTable()}
function message(text){$('formMessage').textContent=text}
function editProduct(model){const p=metadata(model),s=localState(p);$('editing').value=model;$('newModel').value=p.model;$('newModel').readOnly=true;$('newName').value=p.name||p.model;$('newBrand').value=p.brand||'';$('newCategory').value=p.category||'Other';$('newVariant').value=p.variant||'';$('newUrl').value=p.product_url||'';$('newTarget').value=s.target??'';$('newPrice').value=s.current_price_eur??p.current_price_eur??'';$('newStatus').value=s.status;$('newNotes').value=s.notes||'';$('newEnabled').checked=p.enabled!==false;$('saveProduct').textContent='Save shopping details';message(isDraft(p)?'Editing a device-only draft.':'Shopping details save on this device. Product changes are included when you export the catalog.');$('manage').scrollIntoView()}
function resetForm(){$('productForm').reset();$('editing').value='';$('newModel').readOnly=false;$('newEnabled').checked=true;$('saveProduct').textContent='Add product draft'}
function persist(){localStorage.setItem(KEY,JSON.stringify(drafts));localStorage.setItem(STATE,JSON.stringify(shopping))}
function removeProduct(model){
 const p=[...catalog,...drafts].find(x=>x.model===model)||metadata(model);
 if(!p||!confirm(`Remove ${p.name||model} from the tracking list?`))return;
 drafts=drafts.filter(x=>x.model!==model);
 if(catalog.some(x=>x.model===model)) shopping[model]={...(shopping[model]||{}),removed:true};
 else delete shopping[model];
 persist();
 renderOptions();
 render();
 message(`${p.name||model} was removed from this list. Publish the exported catalog to stop scheduled tracking.`);
}
function exportCatalog(){const out=products().map(p=>({...p,...(shopping[p.model]?.catalog||{}),target_price_eur:localState(p).target,current_price_eur:localState(p).current_price_eur??manualPrice(p)??null}));const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='products.json';a.click();URL.revokeObjectURL(url);message('Exported products.json. Publish it to the GitHub catalog to enable scheduled checks on all devices.')}
$('productForm').onsubmit=e=>{e.preventDefault();const model=$('newModel').value.trim(),editing=$('editing').value;if(!editing&&products().some(p=>p.model===model)){message('That exact model is already in your list. Use Shopping details on its card.');return}const p={model,name:$('newName').value.trim()||model,brand:$('newBrand').value.trim(),category:$('newCategory').value,variant:$('newVariant').value.trim(),product_url:$('newUrl').value.trim(),enabled:$('newEnabled').checked};const target=$('newTarget').value===''?null:Number($('newTarget').value),currentPrice=$('newPrice').value===''?null:Number($('newPrice').value);if(!model||target!==null&&(!Number.isFinite(target)||target<0)||currentPrice!==null&&(!Number.isFinite(currentPrice)||currentPrice<0)||p.product_url&&!safeUrl(p.product_url)){message('Enter valid current/target prices and an HTTP(S) product URL.');return}if(!catalog.some(x=>x.model===model)){drafts=drafts.filter(x=>x.model!==model);drafts.push({...p,target_price_eur:target})}shopping[model]={status:$('newStatus').value,target,current_price_eur:currentPrice,notes:$('newNotes').value.trim(),catalog:p};persist();renderOptions();render();resetForm();message('Saved on this device. Export and publish the catalog to start or change scheduled tracking.')};
$('cancelEdit').onclick=()=>{resetForm();message('')};$('exportCatalog').onclick=exportCatalog;
$('importCatalog').onchange=async e=>{try{const input=JSON.parse(await e.target.files[0].text());if(!Array.isArray(input)||input.some(p=>!p||typeof p.model!=='string'||!p.model.trim()||!CATEGORIES.includes(p.category))||new Set(input.map(p=>p.model)).size!==input.length)throw Error('Use a product array with unique models and supported categories.');drafts=input.filter(p=>!catalog.some(c=>c.model===p.model));persist();renderOptions();render();message('New catalog products imported as device-only drafts. Published products were preserved.')}catch(error){message('Import failed: '+error.message)}e.target.value=''};
for(const id of ['search','category','roleFilter','shoppingFilter'])$(id).addEventListener('input',render);
for(const id of ['tableModel','tableCountry'])$(id).addEventListener('change',renderTable);
$('resetFilters').onclick=()=>{$('search').value='';$('category').value='';$('roleFilter').value='';$('shoppingFilter').value='';$('tableModel').value='';$('tableCountry').value='';document.querySelectorAll('[data-country]').forEach(x=>x.checked=true);render()};
$('countryFilters').innerHTML=COUNTRIES.map(c=>`<label><input type="checkbox" data-country="${c}" checked> ${FLAGS[c]} ${c}</label>`).join('');document.querySelectorAll('[data-country]').forEach(x=>x.onchange=()=>{renderCards();renderChart()});
$('tableCountry').innerHTML='<option value="">All countries</option>'+COUNTRIES.map(c=>`<option>${c}</option>`).join('');
$('category').innerHTML='<option value="">All categories</option>'+CATEGORIES.map(c=>`<option>${c}</option>`).join('');$('newCategory').innerHTML=CATEGORIES.map(c=>`<option>${c}</option>`).join('');
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=b.dataset.days;document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));renderChart()});
async function load(){const [p,h]=await Promise.all(['data/products.json','data/price-history.json'].map(async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Unable to load '+url);return r.json()}));catalog=p;observations=h;const old=saved('customMonitors',[]);let migrated=0;for(const x of old)if(x.model&&!products().some(p=>p.model===x.model)){drafts.push({...x,category:'Monitor',enabled:true});migrated++}if(migrated)persist();renderOptions();render();const times=h.filter(o=>!o.invalidated_observation).map(o=>Date.parse(o.timestamp)).filter(t=>Number.isFinite(t)&&t<=Date.now()+60000);$('lastUpdated').textContent=times.length?date(Math.max(...times)):'No checks yet'}
load().catch(e=>{$('overview').innerHTML='<div class="panel empty">'+esc(e.message)+'</div>'});
