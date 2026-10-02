// Run: node --test tests/*.test.mjs. No network or external dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('// STORAGE ADAPTERS'),end=source.lastIndexOf('(async()=>{');
function element(){
  const classes=new Set();
  return {style:{},value:'',children:[],textContent:'',innerHTML:'',scrollIntoView(){},
    appendChild(child){this.children.push(child);},querySelector(){return null;},querySelectorAll(){return [];},
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},
      contains(n){return classes.has(n);},toggle(n){if(classes.has(n))classes.delete(n);else classes.add(n);}}};
}
function harness(instant='2026-09-04T19:00:00Z'){
  let clock=instant,account='A';const writes=[],alerts=[],elements=new Map();
  class ClockDate extends Date {
    constructor(...args){super(...(args.length?args:[clock]));}
    static now(){return new Date(clock).getTime();}
  }
  const document={body:element(),addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},
    createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const storage={loadEntries:async()=>[],loadQuestions:async()=>[],getSettings:async()=>({legacy_migrated:false})};
  for(const method of ['saveEntry','deleteEntries','saveQuestion','saveQuestions','markLegacyMigrated','importEntries']){
    storage[method]=async(...args)=>{writes.push({method,args});return args[0];};
  }
  storage.loadEntry=async()=>null;
  const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:null,error:null};}};
  const context=vm.createContext({document,window:{supabaseClient:{from:()=>query},MomentumData:storage,Auth:{getUserId:()=>account},location:{search:'?dev=1'}},
    Date:ClockDate,console,alert:message=>alerts.push(message),confirm:()=>true,setTimeout:fn=>{fn();return 0;},clearTimeout(){}});
  vm.runInContext(source.slice(start,end),context);
  const run=code=>vm.runInContext(code,context);
  run('bootMomentum=async()=>{};updateSessionAccount("A");');
  return {context,run,document,writes,alerts,setClock:value=>{clock=value;},setAccount:value=>{account=value;}};
}

// Separate processes set real device timezones (including DST), rather than
// mocking getDate/getMonth or computing the result using the implementation.
for(const [tz,instant,expected] of [
  ['Asia/Kolkata','2026-09-04T19:00:00Z','2026-09-05'],
  ['America/Los_Angeles','2026-09-05T06:30:00Z','2026-09-04'],
  ['Pacific/Kiritimati','2026-12-31T10:30:00Z','2027-01-01'],
  ['Pacific/Pago_Pago','2027-01-01T10:30:00Z','2026-12-31'],
  ['America/New_York','2026-03-08T07:30:00Z','2026-03-08'],
  ['America/New_York','2026-11-01T06:30:00Z','2026-11-01'],
]){
  test(`local today and calendar offsets in ${tz} at ${instant}`,()=>{
    const script=`import vm from 'node:vm';
      const instant=${JSON.stringify(instant)};
      class ClockDate extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
      const context=vm.createContext({Date:ClockDate,window:{},document:{addEventListener(){}}});
      vm.runInContext(${JSON.stringify(source.slice(start,end))},context);
      console.log(JSON.stringify(vm.runInContext('({today:todayKey(),prev:dateKeyOffset(appNow(),-1),next:dateKeyOffset(appNow(),1)})',context)));`;
    const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:tz},encoding:'utf8'}));
    assert.equal(result.today,expected);
    const around={
      '2026-09-05':['2026-09-04','2026-09-06'],'2026-09-04':['2026-09-03','2026-09-05'],
      '2027-01-01':['2026-12-31','2027-01-02'],'2026-12-31':['2026-12-30','2027-01-01'],
      '2026-03-08':['2026-03-07','2026-03-09'],'2026-11-01':['2026-10-31','2026-11-02']
    }[expected];assert.deepEqual([result.prev,result.next],around);
  });
}

test('form targets its opening day across midnight, and next day does not overwrite it',async()=>{
  const h=harness('2026-09-05T23:30:00');
  h.run('_renderBulkEntry=()=>{};renderDashboard=()=>{};showSummary=()=>{};loadCache=async()=>({});_dataCache={};');
  await h.run('openLog()');h.run('answers={habit:3};');h.setClock('2026-09-06T00:30:00');
  await h.run('finishQuestionnaire()');
  assert.equal(h.writes[0].method,'saveEntry');assert.equal(h.writes[0].args[0],'2026-09-05');
  await h.run('openLogFullEdit()');h.run('answers={habit:1};');await h.run('finishQuestionnaire()');
  assert.equal(h.writes[1].args[0],'2026-09-06');
});

test('demo requires explicit valid opt-in, defaults off even with dev URL, and clears on reload',async()=>{
  const h=harness();assert.equal(h.run('isDemoMode()'),false);
  h.run('toggleDevTools()');assert.equal(h.document.getElementById('dev-body').classList.contains('open'),false);
  for(const date of ['2026-02-30','2026-13-01','bad',42]){
    h.context.date=date;await assert.rejects(h.run('setDemoDate(date)'),/real YYYY-MM-DD/);
  }
  h.setAccount(null);await assert.rejects(h.run("setDemoDate('2026-06-27')"),/Sign in/);
  h.setAccount('A');await h.run("window.MomentumDemo.setDate('2026-06-27')");
  assert.equal(h.run('todayKey()'),'2026-06-27');assert.equal(h.run('window.MomentumDemo.getState().readOnly'),true);
  h.run('toggleDevTools()');assert.equal(h.document.getElementById('dev-body').classList.contains('open'),true);
  assert.equal(harness().run('isDemoMode()'),false);
});

test('all app mutations are blocked during demo, including migration and destructive tool globals',async()=>{
  const h=harness();await h.run("setDemoDate('2026-06-27')");
  h.context.q={key:'custom',text:'Habit',opts:['Low','Mid','High'],polarity:'positive',tier:'A'};
  await assert.rejects(h.run('saveValidatedQuestion(q)'),/read-only/);
  await assert.rejects(h.run("sbUpsert({date:todayKey(),answers:{habit:3}})"),/read-only/);
  await assert.rejects(h.run('sbDeleteAll()'),/disabled/);
  await h.run('runLegacyMigrationIfNeeded()');
  h.run('_buildMQPage=()=>{};window.UserQuestions=Array.from({length:12},(_,i)=>({...q,key:String(i),polarity:i<6?"positive":"negative"}));');
  await h.run("mqChangeTier('0','S');mqRemoveQuestion('0');_addLibRec('wake');_drawerAdd('wake');");
  h.document.getElementById('mq-cust-text').value='New habit';await h.run('mqAddCustom()');
  await h.run('devReset();devImport();handleImport({target:{files:[{}],value:"file"}})');
  assert.equal(h.writes.length,0);
  assert(!/window\.MomentumData\.(saveEntry|saveQuestion|saveQuestions|markLegacyMigrated|deleteQuestion|deleteEntries|importEntries)\(/.test(source));
});

test('logout/account switch clear demo and drafts; same-account refresh retains opt-in',async()=>{
  const h=harness();await h.run("setDemoDate('2026-06-27');answers={habit:3};");
  h.run('updateSessionAccount("A")');assert.equal(h.run('isDemoMode()'),true);
  h.setAccount('B');h.run('updateSessionAccount("B")');
  assert.equal(h.run('isDemoMode()'),false);assert.equal(h.run('Object.keys(answers).length'),0);
  assert.equal(h.run('_entryDate'),null);
  await h.run("setDemoDate('2026-06-27')");h.setAccount(null);h.run('updateSessionAccount(null)');
  assert.equal(h.run('isDemoMode()'),false);
});

test('mode transitions invalidate pending editor reads and stale save contexts',async()=>{
  const h=harness();let resolve;
  h.context.pending=new Promise(r=>{resolve=r;});
  h.run('_renderBulkEntry=()=>{};sbLoadEntry=()=>pending;openLog();');
  const revision=h.run('_appContextRevision');await h.run("setDemoDate('2026-06-27');window.MomentumDemo.clear();");
  resolve({'2026-09-05':{answers:{habit:3}}});await Promise.resolve();
  assert.equal(h.run('Object.keys(answers).length'),0);
  assert.equal(h.document.getElementById('questionnaire').classList.contains('active'),false);
  h.context.revision=revision;
  await assert.rejects(h.run("sbUpsert({date:'2026-06-27',answers:{habit:3}},revision)"),/changed/);
  assert.equal(h.writes.length,0);
});

test('all graph/summary/filter calendar keys use local helpers without UTC slices',()=>{
  assert(!source.includes('toISOString()'));
  const h=harness('2026-09-05T00:30:00');
  h.run('window.graphs={};renderLineGraph=(id,points)=>{window.graphs[id]=points;};');
  h.run("renderWeekLineGraph({'2026-09-05':{computed:{finalDv:1}}});renderMonthLineGraph({'2026-09-05':{computed:{newVelocity:101}}});");
  const week=h.context.window.graphs['week-line-svg'];assert.equal(week.length,7);
  assert.equal(week.at(-1).isToday,true);assert.equal(week.at(-1).value,1);
  h.context.cache={'2026-08-28':{},'2026-08-29':{},'2026-09-05':{}};
  assert.deepEqual(Array.from(h.run("getFilteredKeys(cache,'week')")),['2026-08-29','2026-09-05']);
});

test('a pre-demo migration cannot resume production writes after mode changes',async()=>{
  const h=harness();let resolve;
  h.context.console={warn(){},error(){}};
  h.context.window.MomentumData.getSettings=()=>new Promise(r=>{resolve=r;});
  const migration=h.run('runLegacyMigrationIfNeeded()');
  await h.run("setDemoDate('2026-06-27');window.MomentumDemo.clear();");
  resolve({legacy_migrated:false});await migration;
  assert.equal(h.writes.length,0);
});


test('dashboard read failure shows an error and retry without rendering an empty history',async()=>{
  const h=harness();
  h.run('window.scrollTo=()=>{};_dataCache=null;renderDashboard=cache=>{window.renderedCache=cache;};loadCache=async()=>{throw new Error("offline");};');
  h.run("showPage('dashboard')");
  await new Promise(resolve=>setImmediate(resolve));
  const status=h.document.getElementById('dashboard-load-status');
  assert.match(status.textContent,/Could not load/);
  assert.equal(status.style.display,'block');
  assert.equal(h.run('_dataCache'),null);
  assert.equal(h.context.window.renderedCache,undefined);
  const retry=status.children.at(-1);
  assert.equal(retry.textContent,'Retry');
  h.run('loadCache=async()=>({"2026-09-05":{answers:{habit:3}}});');
  retry.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(status.style.display,'none');
  assert.equal(h.context.window.renderedCache['2026-09-05'].answers.habit,3);
  assert.equal(h.run('_dataCache["2026-09-05"].answers.habit'),3);
});

test('late dashboard failure from a prior account cannot display its retry status',async()=>{
  const h=harness();
  h.run('loadCache=()=>new Promise((resolve,reject)=>{window.rejectDashboard=reject;});');
  const pending=h.run('loadDashboard()');
  h.setAccount('B');h.run('updateSessionAccount("B");');
  h.context.window.rejectDashboard(new Error('stale'));
  await pending;
  assert.equal(h.document.getElementById('dashboard-load-status').style.display,'none');
});
