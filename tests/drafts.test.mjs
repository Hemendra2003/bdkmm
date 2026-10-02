// Run: node --test tests/*.test.mjs. All persistence/network surfaces are local
// test doubles; actual editor, read adapter, draft and save functions execute.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const app=source.slice(source.indexOf('// STORAGE ADAPTERS'),source.lastIndexOf('(async()=>{'));
function localStore(){
  const data=new Map();
  return {data,get length(){return data.size;},key:i=>Array.from(data.keys())[i]??null,
    getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function element(){
  const classes=new Set();
  return {style:{},value:'',children:[],textContent:'',disabled:false,querySelectorAll(){return [];},
    scrollIntoView(){},appendChild(child){this.children.push(child);},
    classList:{add(...values){values.forEach(v=>classes.add(v));},remove(...values){values.forEach(v=>classes.delete(v));},
      contains:v=>classes.has(v),toggle(v){classes.has(v)?classes.delete(v):classes.add(v);}}};
}
function harness(localStorage=localStore()){
  let account='A',clock='2026-09-05T12:00:00';const elements=new Map(),writes=[],queries=[],events=[],alerts=[];
  const entries=new Map();
  const h={entries,writes,queries,events,alerts,localStorage,read:null,save:null,refresh:null};
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return new Date(clock).getTime();}}
  const document={body:element(),addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},createElement:element,
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const client={from(table){
    const query={table,filters:{}};queries.push(query);
    return {select(fields){query.fields=fields;return this;},eq(field,value){query.filters[field]=value;return this;},
      async maybeSingle(){if(h.read)return h.read(query);return {data:entries.get(query.filters.user_id+':'+query.filters.date)??null,error:null};}};
  }};
  const storage={
    async saveEntry(date,answers){
      writes.push({userId:account,date,answers:{...answers}});
      if(h.save)return h.save(date,answers);
      const entry={date,answers:{...answers}};entries.set(account+':'+date,entry);return entry;
    },
    async loadEntries(){if(h.refresh)return h.refresh();return Array.from(entries.entries()).filter(([key])=>key.startsWith(account+':')).map(([,value])=>value);}
  };
  const context=vm.createContext({window:{localStorage,supabaseClient:client,Storage:storage,Auth:{getUserId:()=>account},
      dispatchEvent:event=>events.push(event)},document,Date:ClockDate,console,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    alert:message=>alerts.push(message),setTimeout:fn=>{fn();return 0;},clearTimeout(){}});
  vm.runInContext(app,context);const run=code=>vm.runInContext(code,context);
  run('bootMomentum=async()=>{};updateSessionAccount("A");_renderBulkEntry=()=>{};renderDashboard=()=>{};showSummary=()=>{};');
  run('window.UserQuestions=[{key:"habit",text:"Habit",opts:["Low","Mid","High"],tier:"A",polarity:"positive"},{key:"other",text:"Other",opts:["Low","Mid","High"],tier:"B",polarity:"positive"}];');
  Object.assign(h,{run,context,document,key:date=>run(`draftKey("A",${JSON.stringify(date)})`),
    setClock:value=>{clock=value;},switchAccount(value){account=value;context.nextAccount=value;run('updateSessionAccount(nextAccount)');}});
  return h;
}
const state=h=>h.run('window.MomentumEntry.getState()');
const selected=h=>JSON.parse(h.run('JSON.stringify(answers)'));

test('each selection persists owner/date draft; close/reopen and page reload restore it',async()=>{
  const h=harness();await h.run('openLog()');
  h.run('_selectBulkAnswer("habit",1)');
  assert.equal(JSON.parse(h.localStorage.getItem(h.key('2026-09-05'))).answers.habit,1);
  h.run('_selectBulkAnswer("habit",3);_selectBulkAnswer("other",2);closeQuestionnaire();');
  assert.deepEqual(JSON.parse(h.localStorage.getItem(h.key('2026-09-05'))).answers,{habit:3,other:2});
  await h.run('openLog()');assert.deepEqual(selected(h),{habit:3,other:2});
  const reloaded=harness(h.localStorage);await reloaded.run('openLog()');
  assert.deepEqual(selected(reloaded),{habit:3,other:2});
});

test('draft merges with saved answers and exact read includes authenticated owner/date filters',async()=>{
  const h=harness();h.entries.set('A:2026-09-05',{date:'2026-09-05',answers:{habit:1,other:3}});
  h.localStorage.setItem(h.key('2026-09-05'),JSON.stringify({version:1,userId:'A',date:'2026-09-05',answers:{habit:2}}));
  await h.run('openLogFullEdit()');assert.deepEqual(selected(h),{habit:2,other:3});
  assert.deepEqual(h.queries[0].filters,{user_id:'A',date:'2026-09-05'});
  assert.equal(h.queries[0].table,'momentum_entries');
});

test('pending/failed date read cannot open or save a blank form even with an empty history cache',async()=>{
  const h=harness();let reject;
  h.read=()=>new Promise((resolve,r)=>{reject=r;});h.run('_dataCache={};');
  const open=h.run('openLog()');
  assert.equal(state(h).status,'loading');assert.equal(state(h).canSave,false);
  assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),false);
  h.run('_selectBulkAnswer("habit",3)');assert.equal(await h.run('finishQuestionnaire()'),false);
  assert.equal(h.writes.length,0);reject(new Error('offline'));assert.equal(await open,false);
  assert.equal(state(h).status,'load-error');assert.deepEqual(selected(h),{});
  assert.equal(await h.run('finishQuestionnaire()'),false);assert.equal(h.writes.length,0);
});

test('load retry preserves original date across midnight and restores the retained draft',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",2);closeQuestionnaire();');
  h.read=async()=>({data:null,error:new Error('offline')});assert.equal(await h.run('openLog()'),false);
  h.setClock('2026-09-06T00:30:00');h.read=null;
  assert.equal(await h.run('window.MomentumEntry.retryLoad()'),true);
  assert.equal(state(h).date,'2026-09-05');assert.deepEqual(selected(h),{habit:2});
});

test('write failure keeps editor and draft; retry saves once successfully and removes draft',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",3)');
  h.save=async()=>{throw new Error('offline');};assert.equal(await h.run('finishQuestionnaire()'),false);
  assert.equal(state(h).status,'save-error');assert.equal(state(h).canSave,true);
  assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),true);
  assert.deepEqual(selected(h),{habit:3});assert(h.localStorage.getItem(h.key('2026-09-05')));
  h.save=null;assert.equal(await h.run('finishQuestionnaire()'),true);
  assert.equal(h.writes.length,2);assert.equal(h.localStorage.getItem(h.key('2026-09-05')),null);
  assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),false);
});

test('duplicate saves/answer changes/closing are blocked during an in-flight save',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",1)');let resolve;
  h.save=()=>new Promise(r=>{resolve=r;});const save=h.run('finishQuestionnaire()');
  h.run('_selectBulkAnswer("habit",3);closeQuestionnaire();');
  assert.deepEqual(selected(h),{habit:1});assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),true);
  assert.equal(await h.run('finishQuestionnaire()'),false);assert.equal(await h.run('openLog()'),false);
  assert.equal(h.writes.length,1);resolve({});await save;
});

test('successful write plus failed refresh reports saved and removes draft without offering duplicate retry',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",3)');
  h.refresh=async()=>{throw new Error('offline');};assert.equal(await h.run('finishQuestionnaire()'),true);
  assert.equal(state(h).status,'refresh-error');assert.match(state(h).error,/Entry saved/);assert.equal(state(h).canSave,false);
  assert.equal(h.localStorage.getItem(h.key('2026-09-05')),null);assert.equal(h.writes.length,1);
  h.refresh=null;await h.run('openLog()');assert.deepEqual(selected(h),{habit:3});
});

test('switch/logout remove only old-owner drafts; another account never sees old answers',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",3)');
  h.localStorage.setItem('unrelated','keep');
  const bkey=h.run('draftKey("B","2026-09-05")');
  h.localStorage.setItem(bkey,JSON.stringify({version:1,userId:'B',date:'2026-09-05',answers:{other:1}}));
  h.switchAccount('B');assert.equal(h.localStorage.getItem(h.key('2026-09-05')),null);
  await h.run('openLog()');assert.deepEqual(selected(h),{other:1});
  h.switchAccount(null);assert.equal(h.localStorage.getItem(bkey),null);assert.equal(h.localStorage.getItem('unrelated'),'keep');
  assert.deepEqual(selected(h),{});assert.equal(state(h).canSave,false);
});

test('malformed/wrong-owner/invalid-choice drafts do not replace saved answers',async()=>{
  for(const value of ['{',JSON.stringify({version:1,userId:'B',date:'2026-09-05',answers:{habit:3}}),
    JSON.stringify({version:1,userId:'A',date:'2026-09-04',answers:{habit:3}}),
    JSON.stringify({version:1,userId:'A',date:'2026-09-05',answers:{habit:'3'}})]){
    const h=harness();h.entries.set('A:2026-09-05',{date:'2026-09-05',answers:{habit:1}});
    h.localStorage.setItem(h.key('2026-09-05'),value);await h.run('openLog()');
    assert.deepEqual(selected(h),{habit:1});assert.match(state(h).draftError,/could not be restored/);
  }
});

test('localStorage quota failure leaves in-memory answers/save available with honest draft warning',async()=>{
  const store=localStore();store.setItem=()=>{throw new Error('quota');};const h=harness(store);
  await h.run('openLog()');h.run('_selectBulkAnswer("habit",2)');
  assert.deepEqual(selected(h),{habit:2});assert.equal(state(h).canSave,true);assert.match(state(h).draftError,/could not keep a draft/);
  assert.equal(await h.run('finishQuestionnaire()'),true);assert.equal(h.writes[0].answers.habit,2);
});

test('demo selection never persists or writes; exiting demo restores real draft',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",1)');
  const original=h.localStorage.getItem(h.key('2026-09-05'));
  await h.run("setDemoDate('2026-06-27');openLog()");h.run('_selectBulkAnswer("habit",3)');
  assert.equal(await h.run('finishQuestionnaire()'),false);assert.equal(h.writes.length,0);
  assert.equal(h.localStorage.getItem(h.key('2026-06-27')),null);assert.equal(h.localStorage.getItem(h.key('2026-09-05')),original);
  await h.run('window.MomentumDemo.clear();openLog()');assert.deepEqual(selected(h),{habit:1});
});

test('old account read cannot open editor or populate new account answers',async()=>{
  const h=harness();let resolve;h.read=()=>new Promise(r=>{resolve=r;});const old=h.run('openLog()');
  h.switchAccount('B');resolve({data:{date:'2026-09-05',answers:{habit:3}},error:null});await old;
  assert.deepEqual(selected(h),{});assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),false);
});

test('late old save success does not delete a new same-day draft or update its UI',async()=>{
  const h=harness();await h.run('openLog()');h.run('_selectBulkAnswer("habit",1)');let resolve;
  h.save=()=>new Promise(r=>{resolve=r;});const old=h.run('finishQuestionnaire()');
  await h.run("setDemoDate('2026-06-27');window.MomentumDemo.clear();openLog()");
  h.run('_selectBulkAnswer("habit",3)');const newer=h.localStorage.getItem(h.key('2026-09-05'));
  resolve({});await old;assert.equal(h.localStorage.getItem(h.key('2026-09-05')),newer);
  assert.deepEqual(selected(h),{habit:3});assert.equal(state(h).status,'ready');
});

test('missing/malformed targeted read result blocks editing and state hook exposes retry error as text',async()=>{
  const h=harness();h.read=async()=>({data:undefined,error:null});await h.run('openLog()');
  assert.equal(state(h).status,'load-error');assert.equal(state(h).canSave,false);
  assert.equal(h.document.getElementById('be-entry-status').textContent,state(h).error);
  assert(h.events.some(event=>event.type==='momentum-entry-change'&&event.detail.status==='load-error'));
});
