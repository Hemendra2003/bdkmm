// Run: node --test tests/safe-render.test.mjs
// No network or browser dependencies. Executes real app functions with a tiny
// DOM stub; verifies source-to-sink encoding and closure-bound event handlers.
// Browser follow-up: add <b>AUDIT MARKUP</b> with an option <img src=x onerror=alert(1)>.
// Check Manage Questions, entry, and Habits (before/after logging): text must
// display literally; inspect Elements to confirm no injected b/img or handlers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[entity]);
class Element {
  constructor(){
    this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';
    this.classList={add(){},remove(){},toggle(){},contains(){return false;}};
  }
  appendChild(child){this.children.push(child);return child;}
  scrollIntoView(){}
  set innerHTML(html){
    this.html=html;this.children=[];
    // Keep a minimal representation of generated controls for querying/clicking.
    for(const match of html.matchAll(/<(button|span|div)\b([^>]*)>([^<]*)/g)){
      const node=new Element();
      node.className=/class="([^"]*)"/.exec(match[2])?.[1]||'';
      node.dataset.tier=/data-tier="([^"]*)"/.exec(match[2])?.[1];
      node.textContent=decode(match[3]);this.children.push(node);
    }
  }
  get innerHTML(){return this.html||'';}
  querySelectorAll(selector){
    const cls=selector.slice(1);
    return this.children.filter(node=>(node.className||'').split(' ').includes(cls));
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function harness(){
  const elements=new Map();
  const document={addEventListener(){},createElement(){return new Element();},
    querySelector(){return null;},querySelectorAll(){return [];},
    getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}};
  const context=vm.createContext({window:{},document,console,Date,setTimeout,clearTimeout,alert(){},confirm(){return true;}});
  const start=source.indexOf('// STORAGE ADAPTERS'),end=source.lastIndexOf('(async()=>{');
  assert(start>0&&end>start);
  vm.runInContext(source.slice(start,end),context);
  return {context,document,run:code=>vm.runInContext(code,context)};
}
const payload='<img src=x onerror="window.injected=1"> & <svg onload=alert(1)>\'"';
const key="q');window.injected=1;//\"><img src=x onerror=alert(1)>";
const question={key,text:payload,opts:[payload,'Partial','Full'],tier:payload,polarity:'positive'};
function safeHTML(html){
  assert(!/<(?:img|svg|script)\b/i.test(html),'injected element must not reach HTML');
  assert(!/\bon(?:error|load)\s*=/i.test(html.replace(/&lt;.*?&gt;/g,'')),'no injected handler');
  assert(!html.includes(key),'user key must not be interpolated into HTML/JavaScript');
}

test('entry escapes persisted question/tier and uses literal option labels',()=>{
  const h=harness();h.context.q=question;
  const row=h.run('_buildBulkRow(q,false)');
  const html=row.children[0].innerHTML;
  safeHTML(html);
  assert(html.includes('&lt;img src=x onerror=&quot;window.injected=1&quot;&gt;'));
  assert.equal(row.children[1].children[0].textContent,payload);
  assert.equal(row.id,'be-row-'+key);
});

test('management escapes fixed/custom rows and preserves opaque keys in handlers',()=>{
  const h=harness();h.context.q=question;
  const fixed=h.run('_buildActiveRow(q,true)');safeHTML(fixed.innerHTML);
  assert(fixed.innerHTML.includes('&lt;img'));
  const row=h.run('_buildActiveRow(q,false)');safeHTML(row.innerHTML);
  assert(!row.innerHTML.includes('onclick='));
  h.run('mqChangeTier=(key,tier)=>{window.called=[key,tier];}; mqRemoveQuestion=key=>{window.removed=key;};');
  for(const btn of row.querySelectorAll('.mq-tier-btn')){
    btn.onclick();assert.deepEqual(Array.from(h.context.window.called),[key,btn.dataset.tier]);
  }
  row.querySelector('.mq-remove-btn').onclick();assert.equal(h.context.window.removed,key);
  assert.equal(row.dataset.key,key);
});

test('habits escapes both unlogged and logged rows',async()=>{
  const h=harness();h.context.window.UserQuestions=[question];
  h.run("_habitsCache={'2026-06-27':{answers:{}}};_habitsFilter='all';");
  await h.run('renderHabitsPage()');
  let row=h.document.getElementById('habits-list').children.find(n=>n.className==='habit-row');
  safeHTML(row.innerHTML);assert(row.innerHTML.includes('&lt;img'));
  h.context.answerKey=key;
  h.run("_habitsCache['2026-06-27'].answers[answerKey]=3;");
  await h.run('renderHabitsPage()');
  row=h.document.getElementById('habits-list').children.find(n=>n.className==='habit-row');
  safeHTML(row.innerHTML);assert(row.innerHTML.includes('&lt;img'));assert(row.innerHTML.includes('AVG'));
});

test('recommendations use textContent and library drawer escapes text',()=>{
  const h=harness();h.context.payload=payload;
  h.run('window.UserQuestions=[];QUESTION_LIBRARY[0].text=payload;_buildMQPage();');
  const all=[];const walk=node=>{all.push(node);node.children.forEach(walk);};
  walk(h.document.getElementById('mq-root'));
  const pill=all.find(node=>node.textContent==='▲ '+payload);
  assert(pill,'recommendation must display literal text');
  assert.equal(pill.innerHTML,'');
  h.run("_buildLibraryDrawer('');");
  const rows=h.document.getElementById('drawer-body').children.filter(n=>n.className==='drawer-row');
  assert(rows[0].innerHTML.includes('&lt;img'));safeHTML(rows[0].innerHTML);
});

test('write validation rejects wrong types/lengths before storage and preserves literal valid text',async()=>{
  const h=harness();let writes=[];
  h.context.window.MomentumData={saveQuestion:async q=>{writes.push(q);return q;}};
  const valid={...question,tier:'A',text:'<b>Habit & routine</b>',opts:['<5k steps','Partial','Full']};
  h.context.q=valid;await h.run('saveValidatedQuestion(q)');
  assert.equal(writes[0].text,valid.text);assert.equal(writes[0].opts[0],'<5k steps');
  for(const invalid of [null,123,{},'', ' ', 'x'.repeat(81)]){
    h.context.q={...valid,text:invalid};await assert.rejects(h.run('saveValidatedQuestion(q)'),/Question text/);
  }
  for(const opts of [null,'abc',[],['a','b'],['a',3,'c'],['a',' ','c'],['a','b','x'.repeat(81)]]){
    h.context.q={...valid,opts};await assert.rejects(h.run('saveValidatedQuestion(q)'),/option labels/);
  }
  assert.equal(writes.length,1);
  h.context.q={...valid,text:'x'.repeat(80),opts:['a'.repeat(80),'b','c']};
  await h.run('saveValidatedQuestion(q)');assert.equal(writes.length,2);
});

test('custom form rejects programmatic oversized/type input without a write',async()=>{
  const h=harness();let writes=0;h.context.window.MomentumData={saveQuestion:async()=>{writes++;}};
  const text=h.document.getElementById('mq-cust-text');text.value='Valid habit';
  for(const invalid of ['x'.repeat(81),42]){
    h.document.getElementById('mq-opt0').value=invalid;
    await h.run('mqAddCustom()');
    assert.match(h.document.getElementById('mq-cust-err').textContent,/at most 80/);
  }
  h.document.getElementById('mq-opt0').value='';text.value='x'.repeat(81);
  await h.run('mqAddCustom()');assert.equal(writes,0);
});


test('summary comparison safely renders unexpected metadata as literal text',()=>{
  const h=harness();h.context.payload=payload;
  h.run('renderLineGraph=()=>{};');
  h.context.computed={thrust:0,drag:0,newVelocity:payload,finalDv:0,mult:1,posStreak:0,negStreak:0};
  h.run("showSummary(computed,{'2026-06-27':{computed}},'2026-06-27');");
  const card=h.document.getElementById('sh-compare').children[0];
  safeHTML(card.innerHTML);assert(card.innerHTML.includes('&lt;img'));
});

test('custom save keeps literal text/default options and reports failed writes as text',async()=>{
  const h=harness();let saved;
  h.run('_buildMQPage=()=>{};loadUserQuestions=async()=>{};');
  h.context.window.MomentumData={saveQuestion:async q=>{saved=q;}};
  const text=h.document.getElementById('mq-cust-text');text.value='  <b>Habit</b>  ';
  await h.run('mqAddCustom()');
  assert.equal(saved.text,'<b>Habit</b>');
  assert.deepEqual(Array.from(saved.opts),["Didn't do it",'Did it partially','Did it fully']);
  assert.equal(text.value,'');
  h.context.window.MomentumData.saveQuestion=async()=>{throw new Error(payload);};
  text.value='<b>Keep my habit</b>';
  await h.run('mqAddCustom()');
  assert.equal(text.value,'<b>Keep my habit</b>');
  const error=h.document.getElementById('mq-cust-err');
  assert.equal(error.textContent,'Save failed: '+payload);assert.equal(error.innerHTML,'');
});
