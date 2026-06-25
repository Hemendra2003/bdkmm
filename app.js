// STARFIELD
(function(){
  const bgC=document.getElementById('starfield-bg'),fgC=document.getElementById('starfield-fg');
  const bgX=bgC.getContext('2d'),fgX=fgC.getContext('2d');
  let W,H,bgS=[],fgS=[];
  function resize(){
    W=bgC.width=fgC.width=window.innerWidth;H=bgC.height=fgC.height=window.innerHeight;
    bgS=[];for(let i=0;i<200;i++)bgS.push({x:Math.random()*W,y:Math.random()*H,spd:.03+Math.random()*.12,size:Math.random()<.1?2:1,bOp:.06+Math.random()*.22,op:0,ph:Math.random()*Math.PI*2,tr:.002+Math.random()*.005,ta:.03+Math.random()*.15});
    bgS.forEach(s=>s.op=s.bOp);
    fgS=[];for(let i=0;i<20;i++)fgS.push({x:W/2+(Math.random()-.5)*Math.min(W*.9,680),y:Math.random()*H*.85,spd:1+Math.random()*1.5,len:2+Math.random()*6,op:.08+Math.random()*.18});
  }
  function loop(){
    bgX.clearRect(0,0,W,H);
    bgS.forEach(s=>{s.ph+=s.tr;s.op=Math.max(.02,s.bOp+Math.sin(s.ph)*s.ta);s.y+=s.spd;if(s.y>H){s.y=-2;s.x=Math.random()*W;}bgX.fillStyle=`rgba(180,185,220,${s.op.toFixed(3)})`;bgX.fillRect(Math.round(s.x),Math.round(s.y),s.size,s.size);});
    fgX.clearRect(0,0,W,H);
    fgS.forEach((s,i)=>{fgX.fillStyle=`rgba(200,210,240,${s.op.toFixed(3)})`;fgX.fillRect(Math.round(s.x),Math.round(s.y),1,s.len);s.y+=s.spd;if(s.y>H+10)fgS[i]={x:W/2+(Math.random()-.5)*Math.min(W*.9,680),y:-10,spd:1+Math.random()*1.5,len:2+Math.random()*6,op:.07+Math.random()*.18};});
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize',resize);resize();loop();
})();

// STORAGE ADAPTERS
// These wrappers preserve the original app call-sites while routing all data
// through storage.js. Later, storage.js can become local-first without touching
// the dashboard/questionnaire engine.
async function sbLoadAll(){return window.Storage.loadEntries();}
async function sbUpsert(row){return window.Storage.saveEntry(row.date,row.answers);}
async function sbDeleteAll(){return window.Storage.deleteEntries();}
function todayKey(){return new Date().toISOString().slice(0,10);}

// ══════════════════════════════════
// TIER SYSTEM — replaces hardcoded per-question weight arrays.
// Every question now stores polarity + tier; the actual score for a given
// answer is looked up here, not hand-specified per question.
// ══════════════════════════════════
const TIER_WEIGHTS={
  positive:{ S:{bad:-5,   neutral:0, good:8}, A:{bad:-3,   neutral:0, good:5}, B:{bad:-1.5, neutral:0, good:3} },
  negative:{ S:{bad:-10,  neutral:-4,good:0}, A:{bad:-6,   neutral:-2,good:0}, B:{bad:-3,   neutral:-1,good:0} },
};

// strengthIndex 0/1/2 -> 'bad'/'neutral'/'good' lookup key
const STRENGTH_LABEL=['bad','neutral','good'];

function scoreForAnswer(question,strengthIndex){
  const idx=Math.max(0,Math.min(2,strengthIndex));
  const table=TIER_WEIGHTS[question.polarity]||TIER_WEIGHTS.positive;
  const tierRow=table[question.tier]||table.B;
  return tierRow[STRENGTH_LABEL[idx]];
}

// The 3 mandatory questions every user has — fixed S-tier, stable keys so
// migrated/legacy data needs no remapping.
const FIXED_QUESTIONS=[
  {key:'sleep',   text:'Sleep quality', opts:['Poor sleep','Decent rest','Deep & full'],        polarity:'positive', tier:'S', is_fixed:true, source:'library', sort_order:0},
  {key:'mood',    text:'Mood today',    opts:['Low / anxious','Neutral','Positive & clear'],    polarity:'positive', tier:'S', is_fixed:true, source:'library', sort_order:1},
  {key:'overall', text:'Overall day',   opts:['Degenerate','Average','Excellent'],              polarity:'positive', tier:'S', is_fixed:true, source:'library', sort_order:2},
];

// Stock library users can pick from when building their question set.
// Default tier is a suggestion only — user can change it at add-time.
const QUESTION_LIBRARY=[
  {libKey:'wake',       cat:'MORNING',   text:'Wake-up time',             opts:['After 10am','8–10am','Before 8am'],                polarity:'positive', defaultTier:'A'},
  {libKey:'morning',    cat:'MORNING',   text:'Morning feel',             opts:['Rough start','Okay','Sharp & clear'],              polarity:'positive', defaultTier:'B'},
  {libKey:'shower',     cat:'MORNING',   text:'Shower before noon',       opts:['Skipped','Evening','Before noon'],                 polarity:'positive', defaultTier:'B'},
  {libKey:'skincare',   cat:'MORNING',   text:'Skincare + medication',    opts:['Skipped','Partial','Fully done'],                  polarity:'positive', defaultTier:'B'},
  {libKey:'gym',        cat:'BODY',      text:'Gym / workout',            opts:['Rest day','Light movement','Full session'],        polarity:'positive', defaultTier:'A'},
  {libKey:'meals',      cat:'BODY',      text:'Heavy meal (bulking)',     opts:['Skipped / under-ate','Light eating','Hit macros'], polarity:'positive', defaultTier:'B'},
  {libKey:'supps',      cat:'BODY',      text:'Creatine + protein',       opts:['Skipped both','One of two','Both done'],           polarity:'positive', defaultTier:'B'},
  {libKey:'work_noon',  cat:'DEEP WORK', text:'Started work before noon', opts:["Didn't start",'After noon','Before noon'],         polarity:'positive', defaultTier:'A'},
  {libKey:'deep_work',  cat:'DEEP WORK', text:'Productive deep work',     opts:['None','Partial session','Full block'],             polarity:'positive', defaultTier:'S'},
  {libKey:'reading',    cat:'GROWTH',    text:'Reading',                  opts:['None','A little','30+ min'],                       polarity:'positive', defaultTier:'B'},
  {libKey:'mind',       cat:'GROWTH',    text:'Mindfulness / stillness',  opts:['None','Brief','Dedicated'],                        polarity:'positive', defaultTier:'B'},
  {libKey:'doom',       cat:'KILLERS',   text:'Doomscrolling',            opts:['Heavy scrolling','Some scrolling','None at all'],  polarity:'negative', defaultTier:'S'},
  {libKey:'porn',       cat:'KILLERS',   text:'Porn',                     opts:['Heavy use','Slipped once','None at all'],          polarity:'negative', defaultTier:'S'},
  {libKey:'junk_food',  cat:'KILLERS',   text:'Junk food binge',          opts:['Binged','Some junk','Clean eating'],               polarity:'negative', defaultTier:'A'},
  {libKey:'procrast',   cat:'KILLERS',   text:'Procrastination',          opts:['Lost the day','Some delay','Stayed on track'],     polarity:'negative', defaultTier:'A'},
  {libKey:'alcohol',    cat:'KILLERS',   text:'Alcohol',                  opts:['Heavy drinking','1-2 drinks','None'],              polarity:'negative', defaultTier:'A'},
  {libKey:'oversleep',  cat:'KILLERS',   text:'Overslept / wasted morning',opts:['Slept past noon','Slept in a bit','Up on time'],  polarity:'negative', defaultTier:'B'},
];

const MIN_TOTAL_QUESTIONS=10;
const MIN_POLARITY_RATIO=0.3; // each polarity must be >=30% of the active set

// Default placeholder option labels shown when a user writes a custom
// question and hasn't customised the option text yet.
const CUSTOM_OPT_PLACEHOLDERS_POSITIVE=['Didn\'t do it','Did it partially','Did it fully'];
const CUSTOM_OPT_PLACEHOLDERS_NEGATIVE=['Did it heavily','Did it a little','Avoided it'];

function checkBalance(questions){
  const total=questions.length;
  if(total===0) return{ok:false,reason:'No questions.'};
  const posCount=questions.filter(q=>q.polarity==='positive').length;
  const negCount=total-posCount;
  const posRatio=posCount/total,negRatio=negCount/total;
  if(total<MIN_TOTAL_QUESTIONS) return{ok:false,reason:`Need at least ${MIN_TOTAL_QUESTIONS} questions (have ${total}).`,posCount,negCount,total};
  if(posRatio<MIN_POLARITY_RATIO) return{ok:false,reason:`Too few positive-habit questions (need \u226530%, have ${Math.round(posRatio*100)}%).`,posCount,negCount,total};
  if(negRatio<MIN_POLARITY_RATIO) return{ok:false,reason:`Too few negative-habit questions (need \u226530%, have ${Math.round(negRatio*100)}%).`,posCount,negCount,total};
  return{ok:true,posCount,negCount,total};
}

// ══════════════════════════════════
// ONE-TIME LEGACY MIGRATION
// Maps the old hardcoded 15-question set onto the new tier system using
// stable keys (so existing momentum_entries.answers JSON needs no rewrite).
// This entire block is a single-purpose migration path: once a user's
// user_settings.legacy_migrated flag is true, none of this runs again.
// Safe to delete outright in a future cleanup once all users have migrated.
// ══════════════════════════════════
const LEGACY_MIGRATION_MAP=[
  {key:'sleep',     text:'Sleep quality',           opts:['Poor sleep','Decent rest','Deep & full'],           polarity:'positive', tier:'S', is_fixed:true,  sort_order:0},
  {key:'mood',      text:'Mood today',              opts:['Low / anxious','Neutral','Positive & clear'],       polarity:'positive', tier:'S', is_fixed:true,  sort_order:1},
  {key:'overall',   text:'Overall day',             opts:['Degenerate','Average','Excellent'],                 polarity:'positive', tier:'S', is_fixed:true,  sort_order:2},
  {key:'doom',      text:'Doomscrolling',           opts:['Heavy scrolling','Some scrolling','None at all'],   polarity:'negative', tier:'S', is_fixed:false, sort_order:3},
  {key:'deep_work', text:'Productive deep work',    opts:['None','Partial session','Full block'],              polarity:'positive', tier:'S', is_fixed:false, sort_order:4},
  {key:'gym',       text:'Gym / workout',           opts:['Rest day','Light movement','Full session'],         polarity:'positive', tier:'A', is_fixed:false, sort_order:5},
  {key:'wake',      text:'Wake-up time',            opts:['After 10am','8–10am','Before 8am'],                 polarity:'positive', tier:'A', is_fixed:false, sort_order:6},
  {key:'work_noon', text:'Started work before noon',opts:["Didn't start",'After noon','Before noon'],          polarity:'positive', tier:'A', is_fixed:false, sort_order:7},
  {key:'shower',    text:'Shower before noon',      opts:['Skipped','Evening','Before noon'],                  polarity:'positive', tier:'B', is_fixed:false, sort_order:8},
  {key:'meals',     text:'Heavy meal (bulking)',    opts:['Skipped / under-ate','Light eating','Hit macros'],  polarity:'positive', tier:'B', is_fixed:false, sort_order:9},
  {key:'reading',   text:'Reading',                 opts:['None','A little','30+ min'],                       polarity:'positive', tier:'B', is_fixed:false, sort_order:10},
  {key:'mind',      text:'Mindfulness / stillness', opts:['None','Brief','Dedicated'],                         polarity:'positive', tier:'B', is_fixed:false, sort_order:11},
  {key:'morning',   text:'Morning feel',            opts:['Rough start','Okay','Sharp & clear'],               polarity:'positive', tier:'B', is_fixed:false, sort_order:12},
  {key:'skincare',  text:'Skincare + medication',   opts:['Skipped','Partial','Fully done'],                   polarity:'positive', tier:'B', is_fixed:false, sort_order:13},
  {key:'supps',     text:'Creatine + protein',      opts:['Skipped both','One of two','Both done'],            polarity:'positive', tier:'B', is_fixed:false, sort_order:14},
];

// Runs once per user, only if they have zero rows in user_questions yet.
// Returns {migrated:boolean, balanceWarning:string|null}
async function runLegacyMigrationIfNeeded(){
  let settings;
  try{settings=await window.Storage.getSettings();}catch(e){console.warn('Settings check failed:',e.message);return{migrated:false,balanceWarning:null};}
  if(settings.legacy_migrated) return{migrated:false,balanceWarning:null};

  let existing;
  try{existing=await window.Storage.loadQuestions();}catch(e){console.warn('Question check failed:',e.message);return{migrated:false,balanceWarning:null};}
  if(existing&&existing.length>0){
    // Already has questions (new user who built their own set, or partial
    // migration retry) — just mark migrated and move on, don't overwrite.
    try{await window.Storage.markLegacyMigrated();}catch(e){}
    return{migrated:false,balanceWarning:null};
  }

  const rows=LEGACY_MIGRATION_MAP.map(q=>({...q,source:'library'}));
  try{
    await window.Storage.saveQuestions(rows);
    await window.Storage.markLegacyMigrated();
  }catch(e){
    console.error('Legacy migration failed:',e.message);
    return{migrated:false,balanceWarning:null};
  }

  const balance=checkBalance(rows);
  const balanceWarning=balance.ok?null:
    `Your migrated question set is imbalanced (${balance.posCount} positive / ${balance.negCount} negative). Add at least ${Math.max(0,Math.ceil(rows.length*MIN_POLARITY_RATIO)-balance.negCount)} more negative-habit question(s) in Manage Questions to keep scoring fair.`;
  return{migrated:true,balanceWarning};
}

// ══════════════════════════════════
// USER QUESTIONS — loaded once per session, cached like _dataCache.
// Replaces the old hardcoded QS constant everywhere in the engine.
// ══════════════════════════════════
window.UserQuestions=null; // array of {key,text,opts,polarity,tier,is_fixed,...}

async function loadUserQuestions(){
  const rows=await window.Storage.loadQuestions();
  window.UserQuestions=rows;
  return rows;
}

function getActiveQuestions(){
  return window.UserQuestions||[];
}

// ENGINE
function runEngine(answers,prevV,posS,negS){
  const questions=getActiveQuestions();
  let thrust=0,drag=0,thrustItems=[],dragItems=[];
  questions.forEach(q=>{
    if(answers[q.key]===undefined||answers[q.key]===null) return;
    const idx=(parseInt(answers[q.key])||1)-1;
    const score=scoreForAnswer(q,idx);
    if(score>0){thrust+=score;thrustItems.push({name:q.text,score});}
    else if(score<0){drag+=Math.abs(score);dragItems.push({name:q.text,score});}
  });
  const rawDv=thrust-drag;
  let mult=1.0;
  if(rawDv>0) mult=Math.min(2.2,1+Math.log(posS+1)/Math.log(1.8)*0.25);
  else if(rawDv<0) mult=Math.min(3.5,1+Math.pow(negS+1,1.4)*0.15);
  mult=Math.round(mult*100)/100;
  const finalDv=Math.round(rawDv*mult);
  return{thrust,drag,rawDv,mult,finalDv,
    newVelocity:Math.max(0,prevV+finalDv),
    posStreak:finalDv>0?posS+1:0,negStreak:finalDv<0?negS+1:0,
    thrustItems,dragItems};
}

function recomputeAll(rows){
  const questions=getActiveQuestions();
  const sorted=[...rows].sort((a,b)=>a.date<b.date?-1:1);
  const cache={};let prevV=100,posS=0,negS=0;
  sorted.forEach(row=>{
    if(!row.answers) return;
    const c=runEngine(row.answers,prevV,posS,negS);
    const pd=Object.keys(cache).sort();
    let shadow=0;
    if(pd.length>=1) shadow+=(cache[pd[pd.length-1]].computed.drag||0)*0.6;
    if(pd.length>=2) shadow+=(cache[pd[pd.length-2]].computed.drag||0)*0.4*0.6;
    const sp=Math.round(shadow*0.5);
    c.newVelocity=Math.max(0,c.newVelocity-sp);c.finalDv-=sp;c.shadow=sp;
    c.posStreak=c.finalDv>0?posS+1:0;c.negStreak=c.finalDv<0?negS+1:0;
    prevV=c.newVelocity;posS=c.posStreak;negS=c.negStreak;
    const ac=Object.keys(row.answers).filter(k=>row.answers[k]!==undefined).length;
    cache[row.date]={answers:row.answers,computed:c,partial:ac<questions.length,answeredCount:ac};
  });
  return cache;
}

async function loadCache(){
  let rows;
  try{rows=await sbLoadAll();}catch(e){console.warn('Load failed:',e.message);return{};}
  if(!rows||!rows.length) return{};
  return recomputeAll(rows);
}

// STATUS LINE
function getStatusLine(c,posS,negS){
  if(!c) return{text:'AWAITING LAUNCH',color:'var(--slate2)'};
  const dv=c.finalDv;
  if(negS>=5) return{text:'COLLAPSE DETECTED.',color:'var(--negred)'};
  if(negS>=3) return{text:'LOSING ALTITUDE.',color:'var(--negred)'};
  if(negS>=1) return{text:'LOSING SPEED.',color:'#FF7070'};
  if(posS>=14&&dv>0) return{text:'UNSTOPPABLE.',color:'var(--green)'};
  if(posS>=7&&dv>0) return{text:'FLYWHEEL ACTIVE.',color:'var(--green)'};
  if(posS>=3&&dv>0) return{text:'BUILDING MOMENTUM.',color:'#8BEF5A'};
  if(dv>10) return{text:'STRONG ACCELERATION.',color:'#3DFF6E'};
  if(dv>0) return{text:'MOVING FORWARD.',color:'#8BEF5A'};
  if(dv===0) return{text:'HOLDING STEADY.',color:'var(--gold)'};
  return{text:'TURBULENCE.',color:'var(--gold)'};
}

// FLAME SCALE
function updateFlameScale(velocity){
  const v=Math.max(0,velocity||100);
  const scale=Math.min(1.8,0.7+Math.log(Math.max(1,v))/Math.log(800)*1.1);
  const brightness=Math.min(1.4,0.8+(v/600)*0.6);
  const flameEl=document.getElementById('flames');
  if(flameEl){
    flameEl.style.transform=`scaleY(${scale.toFixed(2)})`;
    flameEl.style.filter=`brightness(${brightness.toFixed(2)}) drop-shadow(0 0 ${Math.round(v/40)}px rgba(255,184,48,.6))`;
  }
}

// PAGE ROUTING
function showPage(n){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+n).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const navEl=document.getElementById('nav-'+n);
  if(navEl) navEl.classList.add('active');
  window.scrollTo(0,0);
  if(n==='habits') renderHabitsPage();
  if(n==='questions') renderManageQuestions();
}

// DEV TOGGLE
function showDashboardSkeleton(){
  document.getElementById('dashboard-content').classList.add('is-loading');
}
function hideDashboardSkeleton(){
  document.getElementById('dashboard-content').classList.remove('is-loading');
}

function showImbalanceBanner(message){
  const el=document.getElementById('imbalance-banner');
  const textEl=document.getElementById('imbalance-banner-text');
  if(!el||!textEl) return;
  textEl.textContent=message;
  el.style.display='flex';
}
function dismissImbalanceBanner(){
  const el=document.getElementById('imbalance-banner');
  if(el) el.style.display='none';
}

function toggleDevTools(){
  const body=document.getElementById('dev-body');
  const toggle=document.getElementById('dev-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

// ══════════════════════════════════
// QUESTIONNAIRE — open instantly
// ══════════════════════════════════
let currentQ=0,answers={},savedAnswers={};
let activeQueue=[];   // always all active-question indices, in order
let _resumeMode=false; // true = jump to first unanswered on open (begin/resume flow); false = stay at 0 (update flow)
let _dataCache=null;   // shared in-memory cache, refreshed after every write — avoids refetch glitches

function buildQueue(){return getActiveQuestions().map((_,i)=>i);}

function firstUnansweredIdx(){
  const questions=getActiveQuestions();
  for(let i=0;i<activeQueue.length;i++){
    if(answers[questions[activeQueue[i]].key]===undefined) return i;
  }
  return 0; // all answered — start from the top
}

function openLog(){
  answers={};savedAnswers={};_resumeMode=true;
  activeQueue=buildQueue();

  const applyEntry=(cache)=>{
    const te=cache[todayKey()];
    if(te&&te.answers){
      answers={...te.answers};savedAnswers={...te.answers};
      currentQ=firstUnansweredIdx();
    } else {
      currentQ=0;
    }
  };

  if(_dataCache){
    applyEntry(_dataCache); // synchronous — correct question shows on first paint, no flash
    document.getElementById('questionnaire').classList.add('active');
    renderQ();
  } else {
    // cache not warmed yet (rare/first load) — fetch before showing anything
    loadCache().then(cache=>{
      _dataCache=cache;
      applyEntry(cache);
      document.getElementById('questionnaire').classList.add('active');
      renderQ();
    }).catch(()=>{
      currentQ=0;
      document.getElementById('questionnaire').classList.add('active');
      renderQ();
    });
  }
}

// "Update Today's Entry" — full edit mode, shows all 15, highlights prior picks pink
function openLogFullEdit(){
  answers={};savedAnswers={};_resumeMode=false;
  currentQ=0;
  activeQueue=buildQueue();

  const applyEntry=(cache)=>{
    const te=cache[todayKey()];
    if(te&&te.answers){answers={...te.answers};savedAnswers={...te.answers};}
  };

  if(_dataCache){
    applyEntry(_dataCache);
    document.getElementById('questionnaire').classList.add('active');
    renderQ();
  } else {
    loadCache().then(cache=>{
      _dataCache=cache;
      applyEntry(cache);
      document.getElementById('questionnaire').classList.add('active');
      renderQ();
    }).catch(()=>{
      document.getElementById('questionnaire').classList.add('active');
      renderQ();
    });
  }
}

function closeQuestionnaire(){clearAdvanceTimer();document.getElementById('questionnaire').classList.remove('active');}

async function savePartialAndClose(){
  closeQuestionnaire();
  if(!Object.keys(answers).length) return;
  try{await sbUpsert({date:todayKey(),answers});}
  catch(e){alert('Save failed: '+e.message);return;}
  const cache=await loadCache();
  _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
  renderDashboard(cache);
}

function renderQ(){
  const questions=getActiveQuestions();
  const total=activeQueue.length;
  const qIdx=activeQueue[currentQ];
  const q=questions[qIdx];
  document.getElementById('q-progress').style.width=(currentQ/total*100)+'%';
  document.getElementById('q-counter').textContent=String(currentQ+1).padStart(2,'0')+' / '+total;
  document.getElementById('q-category').textContent=q.is_fixed?'CORE':(q.tier+'-TIER · '+(q.polarity==='negative'?'AVOID':'HABIT'));
  document.getElementById('q-text').textContent=q.text;
  document.getElementById('q-back-btn').disabled=currentQ===0;
  const nextBtn=document.getElementById('q-next-btn');
  nextBtn.disabled=false;
  const isLast=currentQ===total-1;
  nextBtn.textContent=isLast?(answers[q.key]===undefined?'Skip & Finish':'Finish ✓'):(answers[q.key]===undefined?'Skip →':'Next →');
  const c=document.getElementById('q-options');c.innerHTML='';
  const wasSavedBefore=savedAnswers[q.key]!==undefined;
  q.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');btn.className='q-option';
    const isCurrent=answers[q.key]===i+1;
    const isPrevSaved=wasSavedBefore&&savedAnswers[q.key]===i+1&&!isCurrent;
    if(isCurrent) btn.classList.add('flash');
    else if(isPrevSaved) btn.classList.add('prev-selected');
    btn.innerHTML=`<span class="q-key">${i+1}</span><span>${opt}</span>`+(isPrevSaved?'<span class="q-prev-tag">PREVIOUS</span>':'');
    btn.onclick=()=>selectAnswer(i);
    c.appendChild(btn);
  });
}

let _advanceTimer=null;
function clearAdvanceTimer(){if(_advanceTimer){clearTimeout(_advanceTimer);_advanceTimer=null;}}

function selectAnswer(idx){
  clearAdvanceTimer();
  const qIdx=activeQueue[currentQ];
  answers[getActiveQuestions()[qIdx].key]=idx+1;
  const opts=document.querySelectorAll('.q-option');
  opts.forEach((o,i)=>{o.classList.toggle('flash',i===idx);o.classList.remove('prev-selected');});
  document.getElementById('q-next-btn').textContent=currentQ===activeQueue.length-1?'Finish ✓':'Next →';
  _advanceTimer=setTimeout(()=>{
    _advanceTimer=null;
    if(currentQ<activeQueue.length-1){currentQ++;renderQ();}
    else finishQuestionnaire();
  },160);
}

function goBack(){clearAdvanceTimer();if(currentQ>0){currentQ--;renderQ();}}
function goNext(){
  clearAdvanceTimer();
  if(currentQ<activeQueue.length-1){currentQ++;renderQ();}
  else finishQuestionnaire();
}

async function finishQuestionnaire(){
  closeQuestionnaire();
  document.getElementById('loading-overlay').classList.add('active');
  const tk=todayKey();
  const startTime=Date.now();
  try{await sbUpsert({date:tk,answers});}
  catch(e){document.getElementById('loading-overlay').classList.remove('active');alert('Save failed: '+e.message);return;}
  const cache=await loadCache();
  _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
  const elapsed=Date.now()-startTime;
  if(elapsed<180) await new Promise(r=>setTimeout(r,180-elapsed));
  document.getElementById('loading-overlay').classList.remove('active');
  if(cache[tk]) showSummary(cache[tk].computed,cache,tk);
  renderDashboard(cache);
}

// SUMMARY
function showSummary(c,cache,tk){
  document.getElementById('summary-overlay').classList.add('active');
  document.getElementById('sh-thrust').textContent='+'+c.thrust;
  document.getElementById('sh-drag').textContent='-'+c.drag;
  document.getElementById('sh-vel').textContent=c.newVelocity;
  const dv=c.finalDv,dvEl=document.getElementById('sh-dv');
  dvEl.textContent=(dv>=0?'+':'')+dv+' KM/S';dvEl.style.color=dv>=0?'var(--green)':'var(--negred)';
  document.getElementById('sh-mult').textContent=c.mult+'× MULTIPLIER';
  const ps=c.posStreak||0,ns=c.negStreak||0,rb=document.getElementById('sh-streak-ribbon');
  document.getElementById('sh-streak-icon').textContent='';
  document.getElementById('sh-streak-text').textContent=ps>0?`${ps}-day clean streak — compounding active`:ns>0?`${ns}-day drag streak — multiplier punishing`:'First entry. Build from here.';
  rb.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid;border-radius:6px;font-family:var(--mono);font-size:11px;margin-bottom:16px;'+(ps>0?'border-color:rgba(61,255,110,.25);background:rgba(61,255,110,.04);color:var(--green)':ns>0?'border-color:rgba(255,48,48,.25);background:rgba(255,48,48,.04);color:var(--negred)':'border-color:rgba(255,184,48,.18);background:rgba(255,184,48,.04);color:var(--gold)');
  const allKeys=Object.keys(cache).sort(),ti=allKeys.indexOf(tk),cKeys=[];
  for(let i=2;i>=1;i--) if(allKeys[ti-i]) cKeys.push(allKeys[ti-i]);
  cKeys.push(tk);
  const labels=cKeys.length===3?['2 days ago','Yesterday','Today']:cKeys.length===2?['Yesterday','Today']:['Today'];
  const cEl=document.getElementById('sh-compare');cEl.innerHTML='';
  cKeys.forEach((k,i)=>{
    const cc=cache[k].computed,it=k===tk;
    const dv2=cc.finalDv,dvS=(dv2>=0?'+':'')+dv2,dvC=dv2>=0?'var(--green)':'var(--negred)';
    const card=document.createElement('div');card.className='compare-card'+(it?' today-card':'');
    card.innerHTML=`<div class="compare-day-label">${labels[i]}</div><div class="compare-vel">${cc.newVelocity}</div><div class="compare-dv" style="color:${dvC}">${dvS} km/s</div>`;
    cEl.appendChild(card);
  });
  const wd=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);wd.push(d.toISOString().slice(0,10));}
  const DN=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const sumPoints=wd.map(k=>({
    label:DN[new Date(k+'T12:00:00').getDay()],
    value:cache[k]?cache[k].computed.finalDv:null,
    isToday:k===tk,
  }));
  renderLineGraph('sum-week-line-svg',null,sumPoints,{centreZero:true,lineColor:'rgba(255,184,48,.95)',fillColor:'rgba(255,184,48,.22)'});
}
function closeSummaryToHome(){document.getElementById('summary-overlay').classList.remove('active');showPage('dashboard');}

// ══════════════════════════════════
// LINE GRAPH RENDERER — smoothed (Catmull-Rom -> cubic bezier)
// ══════════════════════════════════
function smoothPath(coords){
  // coords: [{x,y}] -> smooth SVG path "d" string via Catmull-Rom
  if(coords.length<2) return '';
  if(coords.length===2) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`;
  let d=`M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for(let i=0;i<coords.length-1;i++){
    const p0=coords[i-1]||coords[i];
    const p1=coords[i];
    const p2=coords[i+1];
    const p3=coords[i+2]||p2;
    const c1x=p1.x+(p2.x-p0.x)/6;
    const c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6;
    const c2y=p2.y-(p3.y-p1.y)/6;
    d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function renderLineGraph(svgId, tooltipId, points, opts){
  const svg=document.getElementById(svgId);
  if(!svg) return;
  const W=svg.parentElement.getBoundingClientRect().width||340;
  const H=parseInt(svg.getAttribute('height'))||140;
  const PAD_L=10,PAD_R=10,PAD_T=14,PAD_B=20;
  const gW=W-PAD_L-PAD_R,gH=H-PAD_T-PAD_B;

  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML='';

  const ns='http://www.w3.org/2000/svg';
  const mk=(tag,attrs)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el;};

    const filled=points.filter(p=>p.value!==null);
    if(filled.length===0){
      const t=mk('text',{x:W/2,y:H/2,'text-anchor':'middle',fill:'#505068','font-family':'DM Mono,monospace','font-size':'12','letter-spacing':'.1em'});
      t.textContent='NO DATA YET';svg.appendChild(t);return;
    }

  const vals=filled.map(p=>p.value);
  let minV=Math.min(...vals),maxV=Math.max(...vals);

  // True min/max zoom: lowest point sits just above the base, highest point
  // just below the top margin — small headroom only, so curves read as dramatic
  // even when the underlying variation is small.
  const dataRange=maxV-minV;
  const pad=Math.max(dataRange*.12,opts&&opts.centreZero?1:0.5);
  minV=minV-pad;maxV=maxV+pad;
  if(minV===maxV){minV-=1;maxV+=1;} // guard against flat-line zero-range

  const range=maxV-minV||1;
  const xOf=(i)=>PAD_L+(points.length>1?i/(points.length-1)*gW:gW/2);
  const yOf=(v)=>PAD_T+gH-(((v-minV)/range)*gH);
  const baseY=PAD_T+gH; // bottom of chart area — fill always anchors here

  // gradient anchored to chart pixel bounds (userSpace) so it's always
  // low-opacity at top of chart, high-opacity at the base — visible
  // no matter where the curve sits in range.
  const defs=mk('defs',{});
  const grad=mk('linearGradient',{id:svgId+'_grad',x1:'0',y1:PAD_T,x2:'0',y2:baseY,gradientUnits:'userSpaceOnUse'});
  const fillCol=opts&&opts.fillColor?opts.fillColor:'rgba(255,184,48,1)';
  const fillBase=fillCol.replace(/[\d.]+\)$/,'');
  grad.appendChild(mk('stop',{offset:'0%','stop-color':fillBase+'0.55)'}));
  grad.appendChild(mk('stop',{offset:'45%','stop-color':fillBase+'0.22)'}));
  grad.appendChild(mk('stop',{offset:'100%','stop-color':fillBase+'0.04)'}));
  defs.appendChild(grad);svg.appendChild(defs);

  const segments=[];let cur=[];
  points.forEach((p,i)=>{
    if(p.value===null){if(cur.length>1)segments.push(cur);else cur=[];cur=[];}
    else cur.push({i,v:p.value,p,x:xOf(i),y:yOf(p.value)});
  });
  if(cur.length>1) segments.push(cur);
  else if(cur.length===1) segments.push(cur);

  segments.forEach(seg=>{
    if(seg.length<2) return;
    const path=smoothPath(seg);
    const areaPath=path+` L ${seg[seg.length-1].x.toFixed(1)} ${baseY.toFixed(1)} L ${seg[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
    svg.appendChild(mk('path',{d:areaPath,fill:`url(#${svgId}_grad)`}));
  });

  segments.forEach(seg=>{
    if(seg.length<2) return;
    const path=smoothPath(seg);
    svg.appendChild(mk('path',{d:path,fill:'none',stroke:opts&&opts.lineColor?opts.lineColor:'rgba(255,184,48,.9)','stroke-width':'2','stroke-linejoin':'round','stroke-linecap':'round'}));
  });

  points.forEach((p,i)=>{
    const x=xOf(i);
    if(p.label){
      const lt=mk('text',{
        x:x.toFixed(1),y:(H-5).toFixed(1),'text-anchor':'middle',
        fill:p.isToday?'#FFB830':'#B8B8D0',
        'font-family':'DM Mono,monospace',
        'font-size':p.isToday?'10':'9',
        'font-weight':p.isToday?'500':'400',
        'letter-spacing':'.04em'
      });
      lt.textContent=p.label;svg.appendChild(lt);
    }
    if(p.value===null) return;
    const y=yOf(p.value);
    const baseCol=opts&&opts.dotColor?opts.dotColor:'#FFB830';
    // today's dot+number: green if up from yesterday, red if down, white if no comparison
    const todayCol=opts&&opts.todayTrendColor?opts.todayTrendColor:'#FFFFFF';
    const dotCol=p.isToday?todayCol:baseCol;
    const valCol=p.isToday?todayCol:baseCol;
    svg.appendChild(mk('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:'2.5',fill:dotCol,stroke:p.isToday?'#05060D':'none','stroke-width':'2'}));
    if(points.length<=10||p.isToday){
      const valStr=Math.round(p.value);
      const vt=mk('text',{
        x:x.toFixed(1),y:(y-9).toFixed(1),'text-anchor':'middle',
        fill:valCol,
        'font-family':'DM Mono,monospace',
        'font-size':p.isToday?'14':'12',
        'font-weight':p.isToday?'700':'400'
      });
      vt.textContent=valStr;svg.appendChild(vt);
    }
  });
}

// WEEK LINE GRAPH (Δv, last 7 days)
function renderWeekLineGraph(cache){
  const tk=todayKey();
  const hasToday=!!(cache[tk]&&cache[tk].computed);
  const span=hasToday?7:8; // pull one extra day back so we still show 7 *logged* days when today is empty
  const days=[];for(let i=span-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const trimmed=hasToday?days:days.filter(k=>k!==tk).slice(-7);
  const DN=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const points=trimmed.map(k=>({
    label:DN[new Date(k+'T12:00:00').getDay()],
    value:(cache[k]&&cache[k].computed)?cache[k].computed.finalDv:null,
    isToday:k===tk,
  }));
  const filledWk=points.filter(p=>p.value!==null);
  const wkTrend=filledWk.length>=2?(filledWk[filledWk.length-1].value>filledWk[filledWk.length-2].value?'#3DFF6E':'#FF4444'):null;
  renderLineGraph('week-line-svg','week-tooltip',points,{centreZero:true,lineColor:'rgba(255,184,48,.95)',fillColor:'rgba(255,184,48,.22)',dotColor:'#FFB830',todayTrendColor:wkTrend||'#FFFFFF'});
}

// MONTH LINE GRAPH — responsive: shows actual logged span, up to 30 days
function renderMonthLineGraph(cache){
  const allKeys=Object.keys(cache).filter(k=>cache[k]&&cache[k].computed).sort();
  const tk=todayKey();
  let spanDays=30;
  if(allKeys.length>0){
    const earliest=new Date(allKeys[0]+'T12:00:00');
    const today=new Date(tk+'T12:00:00');
    const daysSinceEarliest=Math.round((today-earliest)/86400000)+1;
    spanDays=Math.max(1,Math.min(30,daysSinceEarliest));
  }
  const days=[];for(let i=spanDays-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const hasToday=!!(cache[tk]&&cache[tk].computed);
  let trimmedDays=hasToday?days:days.filter(k=>k!==tk);
  if(trimmedDays.length===0) trimmedDays=days; // fallback: nothing logged yet at all
  const labelEvery=trimmedDays.length<=7?1:trimmedDays.length<=14?2:5;
  const points=trimmedDays.map((k,i)=>{
    const d=new Date(k+'T12:00:00');
    const dayNum=d.getDate();
    const showLabel=i===0||i===trimmedDays.length-1||i%labelEvery===0||k===tk;
    return{
      label:showLabel?String(dayNum):'',
      value:(cache[k]&&cache[k].computed)?cache[k].computed.newVelocity:null,
      isToday:k===tk,
    };
  });
  const filledMo=points.filter(p=>p.value!==null);
  const moTrend=filledMo.length>=2?(filledMo[filledMo.length-1].value>filledMo[filledMo.length-2].value?'#3DFF6E':'#FF4444'):null;
  renderLineGraph('month-line-svg','month-tooltip',points,{centreZero:false,lineColor:'rgba(91,191,255,.9)',fillColor:'rgba(91,191,255,.2)',dotColor:'#5BBFFF',todayTrendColor:moTrend||'#5BBFFF'});
}

// DASHBOARD RENDER
function renderDashboard(cache){
  const tk=todayKey();
  const dl=document.getElementById('today-date-label');
  if(dl){const d=new Date();dl.textContent=d.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();}

  const keys=Object.keys(cache).sort();
  const te=cache[tk];
  const prevKey=keys[keys.indexOf(tk)-1];
  const prev=prevKey?cache[prevKey]:null;
  const btn=document.getElementById('open-log-btn');
  const isFirstLaunch=keys.length===0;

  if(te&&te.computed){
    const c=te.computed;
    const isPartial=te.partial;
    document.getElementById('velocity-display').textContent=c.newVelocity;
    updateFlameScale(c.newVelocity);
    const sl=getStatusLine(c,c.posStreak||0,c.negStreak||0);
    const slEl=document.getElementById('status-line');
    slEl.textContent=sl.text;slEl.style.color=sl.color;

    if(prev&&prev.computed){
      const diff=c.newVelocity-prev.computed.newVelocity;
      document.getElementById('delta-badge').style.display='flex';
      document.getElementById('badge-sep-1').style.display='block';
      const dn=document.getElementById('delta-badge-num');
      dn.textContent=(diff>=0?'+':'-')+Math.abs(diff);
    }
    document.getElementById('mult-text').textContent=c.mult+'×';
    renderStreakBadge(c.posStreak||0,c.negStreak||0);
    document.getElementById('empty-state').style.display='none';

    btn.className='btn';
    if(isPartial){
      btn.classList.add('btn-primary-blue');btn.disabled=false;
      btn.textContent='Resume Entry — '+te.answeredCount+'/'+getActiveQuestions().length+' answered';
      btn.onclick=openLog;
    } else {
      btn.classList.add('btn-primary-green');btn.disabled=false;
      btn.textContent='Update Today\'s Entry';
      btn.onclick=openLogFullEdit;
    }
  } else {
    const last=keys.length?cache[keys[keys.length-1]]:null;
    const lastV=last?last.computed.newVelocity:100;
    document.getElementById('velocity-display').textContent=lastV;
    updateFlameScale(lastV);
    const slEl=document.getElementById('status-line');
    if(isFirstLaunch){slEl.textContent='LAUNCH SEQUENCE READY';slEl.style.color='var(--slate2)';}
    else{slEl.textContent='LOG TODAY TO UPDATE';slEl.style.color='var(--slate2)';}
    document.getElementById('delta-badge').style.display='none';
    document.getElementById('badge-sep-1').style.display='none';
    document.getElementById('mult-text').textContent='—';
    let posS=0,negS=0;
    for(let i=keys.length-1;i>=0;i--){
      const e=cache[keys[i]];
      if(e&&e.computed&&e.computed.finalDv>0&&negS===0) posS++;
      else if(e&&e.computed&&e.computed.finalDv<0&&posS===0) negS++;
      else break;
    }
    renderStreakBadge(posS,negS);
    document.getElementById('empty-state').style.display=isFirstLaunch?'block':'none';
    btn.className='btn btn-primary-gold';btn.disabled=false;btn.textContent='Begin Today\'s Entry';btn.onclick=openLog;
  }

  document.getElementById('logged-note').textContent='';
  const allVels=keys.filter(k=>cache[k]&&cache[k].computed).map(k=>cache[k].computed.newVelocity);
  document.getElementById('stat-best').textContent=allVels.length?Math.max(...allVels):'—';
  document.getElementById('stat-days').textContent=keys.length||'0';
  let streak=0;
  for(let i=keys.length-1;i>=0;i--){if(cache[keys[i]]&&cache[keys[i]].computed&&cache[keys[i]].computed.finalDv>0)streak++;else break;}
  document.getElementById('stat-streak').textContent=streak||'0';

  renderWeekLineGraph(cache);
  renderMonthLineGraph(cache);
}

function renderStreakBadge(posS,negS){
  const numEl=document.getElementById('streak-badge-num');
  const lblEl=document.getElementById('streak-badge-label');
  if(posS>0){
    numEl.innerHTML='<span class="h-badge-num-row">'+posS+'<span class="badge-emoji">⚡</span></span>';lblEl.textContent='DAY STREAK';
  } else if(negS>0){
    numEl.innerHTML='<span class="h-badge-num-row">'+negS+'<span class="badge-emoji">⚡</span></span>';lblEl.textContent='DAY DRAG';
  } else {
    numEl.textContent='—';lblEl.textContent='STREAK';
  }
}

// HABITS PAGE
let _habitsCache=null,_habitsFilter='all';

function setHabitsFilter(filter){
  _habitsFilter=filter;
  document.querySelectorAll('.filter-btn').forEach(btn=>{btn.classList.toggle('active',btn.dataset.filter===filter);});
  renderHabitsPage();
}
function getFilteredKeys(cache,filter){
  const allKeys=Object.keys(cache).sort();
  if(filter==='all') return allKeys;
  const now=new Date(),cutoff=new Date();
  if(filter==='week') cutoff.setDate(now.getDate()-7);
  else if(filter==='month') cutoff.setMonth(now.getMonth()-1);
  return allKeys.filter(k=>k>=cutoff.toISOString().slice(0,10));
}
async function renderHabitsPage(){
  const cache=_habitsCache||(await loadCache());_habitsCache=cache;
  const keys=getFilteredKeys(cache,_habitsFilter);
  if(keys.length===0){document.getElementById('habits-list').innerHTML='<div style="font-family:var(--mono);font-size:11px;color:var(--slate2);margin-top:16px;letter-spacing:.08em">No entries in this time period.</div>';return;}
  const questions=getActiveQuestions();
  const stats={};
  questions.forEach(q=>{stats[q.key]={key:q.key,name:q.text,polarity:q.polarity,tier:q.tier,count:0,sumScore:0};});
  keys.forEach(dk=>{
    const entry=cache[dk];if(!entry||!entry.answers) return;
    questions.forEach(q=>{
      const raw=entry.answers[q.key];if(raw===undefined||raw===null) return;
      const score=scoreForAnswer(q,(parseInt(raw)||1)-1);
      stats[q.key].count++;stats[q.key].sumScore+=score;
    });
  });
  questions.forEach(q=>{
    const s=stats[q.key];
    const allScores=[0,1,2].map(i=>scoreForAnswer(q,i));
    const minW=Math.min(...allScores),maxW=Math.max(...allScores),range=maxW-minW;
    if(s.count===0){s.pct=null;return;}
    const avg=s.sumScore/s.count;s.avg=Math.round(avg*10)/10;
    s.pct=range===0?100:Math.round(((avg-minW)/range)*100);
  });
  const groupLabels={positive:'POSITIVE HABITS',negative:'NEGATIVE HABITS'};
  const groups=['positive','negative'];
  const listEl=document.getElementById('habits-list');listEl.innerHTML='';
  groups.forEach(polarity=>{
    const qs=questions.filter(q=>q.polarity===polarity);
    if(!qs.length) return;
    const header=document.createElement('div');header.className='habit-cat-header';header.textContent=groupLabels[polarity];listEl.appendChild(header);
    qs.forEach(q=>{
      const s=stats[q.key];
      if(s.pct===null){
        const row=document.createElement('div');row.className='habit-row';
        row.innerHTML=`<div><div class="habit-name">${q.text}</div><div class="habit-name-sub">NOT YET LOGGED</div></div><div></div><div class="habit-bar-wrap" style="opacity:.3"><div class="habit-bar-fill mid" style="width:0%"></div></div>`;
        listEl.appendChild(row);return;
      }
      const bucket=s.pct>=80?'great':s.pct>=60?'good':s.pct>=40?'mid':'bad';
      const row=document.createElement('div');row.className='habit-row';
      row.innerHTML=`<div><div class="habit-name">${q.text}</div><div class="habit-name-sub">${q.tier}-TIER · AVG ${s.avg>0?'+':''}${s.avg}</div></div><div><div class="habit-score-num ${bucket}">${s.pct}</div><div class="habit-entries">/ 100</div></div><div><div class="habit-bar-wrap"><div class="habit-bar-fill ${bucket}" style="width:${s.pct}%"></div></div></div>`;
      listEl.appendChild(row);
    });
  });
}

// DEV TOOLS
async function devReset(){
  if(!confirm('Reset ALL your Momentum data?'))return;
  try{await sbDeleteAll();}
  catch(e){alert('Reset failed: '+e.message);return;}
  const cache={};
  _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
  renderDashboard(cache);
}
function devExport(){
  sbLoadAll().then(rows=>{
    const b=new Blob([JSON.stringify(rows,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='momentum_'+todayKey()+'.json';
    a.click();
  }).catch(e=>alert('Export failed: '+e.message));
}
function devImport(){document.getElementById('import-file').click();}
async function handleImport(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=async ev=>{try{
    const obj=JSON.parse(ev.target.result);let rows=[];
    if(Array.isArray(obj))rows=obj;
    else if(obj.entries)rows=Object.entries(obj.entries).map(([date,v])=>({date,answers:v.answers||{}}));
    else rows=Object.entries(obj).map(([date,v])=>({date,answers:v.answers||v}));
    await window.Storage.importEntries(rows);
    const cache=await loadCache();
    _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
    renderDashboard(cache);
    alert('Imported '+rows.length+' entries.');
  }catch(err){alert('Import failed: '+err.message);}};
  r.readAsText(file);e.target.value='';
}
async function testDB(){
  const el=document.getElementById('db-status');el.textContent='Testing...';el.style.color='var(--slate2)';
  try{const rows=await sbLoadAll();el.textContent='Connected — '+rows.length+' row(s)';el.style.color='var(--green)';}
  catch(e){el.textContent='Failed: '+e.message.slice(0,80);el.style.color='var(--negred)';}
  setTimeout(()=>{el.textContent='';},6000);
}

// ══════════════════════════════════
// MANAGE QUESTIONS PAGE
// ══════════════════════════════════
let _mqDirty=false; // true when user has unsaved tier changes in-memory

// Called by showPage('questions') via routing
async function renderManageQuestions(){
  const el=document.getElementById('mq-root');
  if(!el) return;
  el.innerHTML='<div class="mq-loading">Loading questions…</div>';
  try{ await loadUserQuestions(); }catch(e){ el.innerHTML='<div class="mq-loading" style="color:var(--negred)">Failed to load questions.</div>'; return; }
  _buildMQPage();
}

function _buildMQPage(){
  const questions=getActiveQuestions();
  const el=document.getElementById('mq-root');
  if(!el) return;

  const bal=checkBalance(questions);

  // ── balance bar ──
  const posC=questions.filter(q=>q.polarity==='positive').length;
  const negC=questions.length-posC;
  const posPct=questions.length?Math.round(posC/questions.length*100):0;
  const negPct=100-posPct;
  const balOk=bal.ok;

  el.innerHTML='';

  // Balance status
  const balDiv=document.createElement('div');
  balDiv.className='mq-balance-bar';
  balDiv.innerHTML=`
    <div class="mq-balance-row">
      <span class="mq-balance-label" style="color:var(--green)">▲ ${posC} positive</span>
      <span class="mq-balance-status ${balOk?'ok':'warn'}">${balOk?'✓ BALANCED':'⚠ IMBALANCED'}</span>
      <span class="mq-balance-label" style="color:var(--negred)">▼ ${negC} negative</span>
    </div>
    <div class="mq-balance-track">
      <div class="mq-balance-fill-pos" style="width:${posPct}%"></div>
      <div class="mq-balance-fill-neg" style="width:${negPct}%"></div>
    </div>
    ${!balOk?`<div class="mq-balance-warn-text">${bal.reason}</div>`:''}
  `;
  el.appendChild(balDiv);

  // ── active questions list ──
  const activeSection=document.createElement('div');
  activeSection.className='mq-section';
  activeSection.innerHTML='<div class="mq-section-title">YOUR QUESTIONS <span class="mq-count">('+questions.length+'/'+MIN_TOTAL_QUESTIONS+' min)</span></div>';

  const fixed=questions.filter(q=>q.is_fixed);
  const nonFixed=questions.filter(q=>!q.is_fixed);

  if(fixed.length){
    const fixedHeader=document.createElement('div');
    fixedHeader.className='mq-group-header';
    fixedHeader.textContent='CORE — always on';
    activeSection.appendChild(fixedHeader);
    fixed.forEach(q=>{
      activeSection.appendChild(_buildActiveRow(q,true));
    });
  }
  if(nonFixed.length){
    const habitHeader=document.createElement('div');
    habitHeader.className='mq-group-header';
    habitHeader.textContent='YOUR HABITS';
    activeSection.appendChild(habitHeader);
    nonFixed.forEach(q=>{
      activeSection.appendChild(_buildActiveRow(q,false));
    });
  }
  el.appendChild(activeSection);

  // ── library browser ──
  const alreadyAdded=new Set(questions.map(q=>q.key));
  const available=QUESTION_LIBRARY.filter(l=>!alreadyAdded.has(l.libKey));

  if(available.length){
    const libSection=document.createElement('div');
    libSection.className='mq-section';
    libSection.innerHTML='<div class="mq-section-title">ADD FROM LIBRARY</div>';

    const cats=[...new Set(available.map(l=>l.cat))];
    cats.forEach(cat=>{
      const catHeader=document.createElement('div');
      catHeader.className='mq-group-header';
      catHeader.textContent=cat;
      libSection.appendChild(catHeader);
      available.filter(l=>l.cat===cat).forEach(libQ=>{
        libSection.appendChild(_buildLibraryRow(libQ));
      });
    });
    el.appendChild(libSection);
  }

  // ── custom question form ──
  const customSection=document.createElement('div');
  customSection.className='mq-section';
  customSection.innerHTML=`
    <div class="mq-section-title">CUSTOM QUESTION</div>
    <div class="mq-custom-form" id="mq-custom-form">
      <div class="mq-field-group">
        <label class="mq-label">Question text</label>
        <input class="mq-input" id="mq-cust-text" placeholder="e.g. Did I journal today?" maxlength="80">
      </div>
      <div class="mq-field-row">
        <div class="mq-field-group" style="flex:1">
          <label class="mq-label">Type</label>
          <div class="mq-segmented" id="mq-cust-polarity">
            <button class="mq-seg active" data-val="positive" onclick="mqSetPolarity('positive')">Positive habit</button>
            <button class="mq-seg" data-val="negative" onclick="mqSetPolarity('negative')">Negative habit</button>
          </div>
        </div>
        <div class="mq-field-group">
          <label class="mq-label">Tier</label>
          <div class="mq-segmented" id="mq-cust-tier">
            <button class="mq-seg" data-val="S" onclick="mqSetTier('S')">S</button>
            <button class="mq-seg active" data-val="A" onclick="mqSetTier('A')">A</button>
            <button class="mq-seg" data-val="B" onclick="mqSetTier('B')">B</button>
          </div>
        </div>
      </div>
      <div class="mq-field-group">
        <label class="mq-label">Option labels <span style="color:var(--slate2);font-weight:400">(worst → best)</span></label>
        <div class="mq-opts-row">
          <input class="mq-input mq-opt-input" id="mq-opt0" placeholder="Didn't do it">
          <input class="mq-input mq-opt-input" id="mq-opt1" placeholder="Did it partially">
          <input class="mq-input mq-opt-input" id="mq-opt2" placeholder="Did it fully">
        </div>
      </div>
      <div class="mq-custom-footer">
        <div class="mq-err" id="mq-cust-err"></div>
        <button class="mq-btn-add" onclick="mqAddCustom()">+ Add question</button>
      </div>
    </div>
  `;
  el.appendChild(customSection);
}

function _buildActiveRow(q,isFixed){
  const row=document.createElement('div');
  row.className='mq-active-row';
  row.dataset.key=q.key;

  const tierColor=q.tier==='S'?'var(--gold)':q.tier==='A'?'var(--blue)':'var(--slate2)';
  const polarityDot=q.polarity==='negative'?`<span class="mq-neg-dot">▼</span>`:`<span class="mq-pos-dot">▲</span>`;

  if(isFixed){
    row.innerHTML=`
      <div class="mq-row-left">
        ${polarityDot}
        <div class="mq-row-text">${q.text}</div>
      </div>
      <div class="mq-row-right">
        <span class="mq-tier-badge" style="color:${tierColor};border-color:${tierColor}">${q.tier}</span>
        <span class="mq-fixed-lock">CORE</span>
      </div>
    `;
  } else {
    row.innerHTML=`
      <div class="mq-row-left">
        ${polarityDot}
        <div class="mq-row-text">${q.text}</div>
      </div>
      <div class="mq-row-right">
        <div class="mq-tier-picker">
          <button class="mq-tier-btn${q.tier==='S'?' active':''}" data-tier="S" style="${q.tier==='S'?'border-color:var(--gold);color:var(--gold)':''}" onclick="mqChangeTier('${q.key}','S')">S</button>
          <button class="mq-tier-btn${q.tier==='A'?' active':''}" data-tier="A" style="${q.tier==='A'?'border-color:var(--blue);color:var(--blue)':''}" onclick="mqChangeTier('${q.key}','A')">A</button>
          <button class="mq-tier-btn${q.tier==='B'?' active':''}" data-tier="B" style="${q.tier==='B'?'border-color:var(--slate2);color:var(--slate2)':''}" onclick="mqChangeTier('${q.key}','B')">B</button>
        </div>
        <button class="mq-remove-btn" onclick="mqRemoveQuestion('${q.key}')">✕</button>
      </div>
    `;
  }
  return row;
}

function _buildLibraryRow(libQ){
  const row=document.createElement('div');
  row.className='mq-lib-row';
  row.id='mq-lib-'+libQ.libKey;

  const tierColor=libQ.defaultTier==='S'?'var(--gold)':libQ.defaultTier==='A'?'var(--blue)':'var(--slate2)';
  const polarityDot=libQ.polarity==='negative'?`<span class="mq-neg-dot">▼</span>`:`<span class="mq-pos-dot">▲</span>`;

  row.innerHTML=`
    <div class="mq-row-left">
      ${polarityDot}
      <div class="mq-row-text">${libQ.text}</div>
    </div>
    <div class="mq-row-right">
      <div class="mq-tier-picker mq-lib-tier-picker" id="mq-ltp-${libQ.libKey}">
        <button class="mq-tier-btn${libQ.defaultTier==='S'?' active':''}" onclick="mqLibSetTier('${libQ.libKey}','S')">S</button>
        <button class="mq-tier-btn${libQ.defaultTier==='A'?' active':''}" onclick="mqLibSetTier('${libQ.libKey}','A')">A</button>
        <button class="mq-tier-btn${libQ.defaultTier==='B'?' active':''}" onclick="mqLibSetTier('${libQ.libKey}','B')">B</button>
      </div>
      <button class="mq-add-btn" onclick="mqAddLibraryQuestion('${libQ.libKey}')">+ Add</button>
    </div>
  `;
  return row;
}

// Track per-library-item tier selection before add
const _mqLibTierSelection={};

function mqLibSetTier(libKey,tier){
  _mqLibTierSelection[libKey]=tier;
  const picker=document.getElementById('mq-ltp-'+libKey);
  if(!picker) return;
  picker.querySelectorAll('.mq-tier-btn').forEach(b=>{
    const t=b.textContent;
    b.classList.toggle('active',t===tier);
    b.style.borderColor=t===tier?(tier==='S'?'var(--gold)':tier==='A'?'var(--blue)':'var(--slate2)'):'';
    b.style.color=b.style.borderColor;
  });
}

async function mqAddLibraryQuestion(libKey){
  const libQ=QUESTION_LIBRARY.find(l=>l.libKey===libKey);
  if(!libQ) return;
  const tier=_mqLibTierSelection[libKey]||libQ.defaultTier;
  const questions=getActiveQuestions();
  const newQ={
    key:libKey,
    text:libQ.text,
    opts:libQ.opts,
    polarity:libQ.polarity,
    tier,
    is_fixed:false,
    source:'library',
    sort_order:questions.length,
  };
  const btn=document.querySelector(`#mq-lib-${libKey} .mq-add-btn`);
  if(btn){btn.disabled=true;btn.textContent='Adding…';}
  try{
    await window.Storage.saveQuestion(newQ);
    await loadUserQuestions();
    _buildMQPage();
    // Invalidate cache so engine uses updated questions on next log
    _habitsCache=null;
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='+ Add';}
    alert('Failed to add question: '+e.message);
  }
}

async function mqRemoveQuestion(key){
  const questions=getActiveQuestions();
  const remaining=questions.filter(q=>q.key!==key);
  const bal=checkBalance(remaining);
  if(!bal.ok&&remaining.length<MIN_TOTAL_QUESTIONS){
    alert(`Can't remove — you'd drop below the minimum of ${MIN_TOTAL_QUESTIONS} questions.`);
    return;
  }
  // Soft balance warning but allow
  if(!bal.ok){
    const ok=confirm(`Warning: removing this will make your set imbalanced (${bal.reason}). Remove anyway?`);
    if(!ok) return;
  }
  try{
    await window.Storage.deleteQuestion(key);
    await loadUserQuestions();
    _habitsCache=null;
    _buildMQPage();
  }catch(e){ alert('Failed to remove: '+e.message); }
}

async function mqChangeTier(key,tier){
  const questions=getActiveQuestions();
  const q=questions.find(q=>q.key===key);
  if(!q) return;
  const updated={...q,tier};
  // Optimistically update UI
  window.UserQuestions=questions.map(qq=>qq.key===key?updated:qq);
  _buildMQPage();
  _habitsCache=null;
  try{
    await window.Storage.saveQuestion(updated);
  }catch(e){
    // Revert on failure
    await loadUserQuestions();
    _buildMQPage();
    alert('Failed to save tier change: '+e.message);
  }
}

let _mqCustPolarity='positive';
let _mqCustTier='A';

function mqSetPolarity(val){
  _mqCustPolarity=val;
  document.querySelectorAll('#mq-cust-polarity .mq-seg').forEach(b=>b.classList.toggle('active',b.dataset.val===val));
  // Update placeholder text to match polarity
  const placeholders=val==='positive'?CUSTOM_OPT_PLACEHOLDERS_POSITIVE:CUSTOM_OPT_PLACEHOLDERS_NEGATIVE;
  ['mq-opt0','mq-opt1','mq-opt2'].forEach((id,i)=>{
    const el=document.getElementById(id);
    if(el) el.placeholder=placeholders[i];
  });
}

function mqSetTier(val){
  _mqCustTier=val;
  document.querySelectorAll('#mq-cust-tier .mq-seg').forEach(b=>b.classList.toggle('active',b.dataset.val===val));
}

async function mqAddCustom(){
  const textEl=document.getElementById('mq-cust-text');
  const errEl=document.getElementById('mq-cust-err');
  const text=(textEl&&textEl.value||'').trim();
  if(!text){errEl&&(errEl.textContent='Enter a question.');return;}

  const placeholders=_mqCustPolarity==='positive'?CUSTOM_OPT_PLACEHOLDERS_POSITIVE:CUSTOM_OPT_PLACEHOLDERS_NEGATIVE;
  const opts=['mq-opt0','mq-opt1','mq-opt2'].map((id,i)=>{
    const el=document.getElementById(id);
    return(el&&el.value.trim())||placeholders[i];
  });

  const questions=getActiveQuestions();
  // Generate a stable unique key
  const key='cust_'+Date.now().toString(36);
  const newQ={
    key,
    text,
    opts,
    polarity:_mqCustPolarity,
    tier:_mqCustTier,
    is_fixed:false,
    source:'custom',
    sort_order:questions.length,
  };

  // Check if adding this would help or maintain balance
  const newSet=[...questions,newQ];
  const bal=checkBalance(newSet);

  if(errEl) errEl.textContent='';
  const btn=document.querySelector('#mq-custom-form .mq-btn-add');
  if(btn){btn.disabled=true;btn.textContent='Adding…';}
  try{
    await window.Storage.saveQuestion(newQ);
    await loadUserQuestions();
    _habitsCache=null;
    // Reset form
    if(textEl) textEl.value='';
    ['mq-opt0','mq-opt1','mq-opt2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    _buildMQPage();
    if(!bal.ok&&errEl){errEl.style.color='var(--gold)';errEl.textContent='Added. '+bal.reason;}
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='+ Add question';}
    if(errEl) errEl.textContent='Save failed: '+e.message;
  }
}

// KEYBOARD
document.addEventListener('keydown',e=>{
  if(document.getElementById('questionnaire').classList.contains('active')){
    if(['1','2','3'].includes(e.key)){e.preventDefault();selectAnswer(parseInt(e.key)-1);return;}
    if(e.key==='Backspace'||e.key==='ArrowLeft'){e.preventDefault();goBack();return;}
    if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();savePartialAndClose();return;}
    if(e.key==='Escape'){closeQuestionnaire();return;}
    return;
  }
  if(document.getElementById('summary-overlay').classList.contains('active')){
    if(e.key==='Enter'){closeSummaryToHome();return;}return;
  }
  if(document.getElementById('page-dashboard').classList.contains('active')){
    if(e.key==='Enter'){const btn=document.getElementById('open-log-btn');if(!btn.disabled)openLog();}
  }
});

// INIT
let _lastRenderedCache={};
let _resizeBound=false;

async function bootMomentum(){
  showDashboardSkeleton();
  try{
    const migrationResult=await runLegacyMigrationIfNeeded();
    await loadUserQuestions();
    const cache=await loadCache();
    _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
    hideDashboardSkeleton();
    renderDashboard(cache);
    if(migrationResult.balanceWarning) showImbalanceBanner(migrationResult.balanceWarning);
    if(!_resizeBound){
      window.addEventListener('resize',()=>renderDashboard(_lastRenderedCache||{}));
      _resizeBound=true;
    }
  }catch(e){
    hideDashboardSkeleton();
    console.error('Boot failed:',e);
    alert('Could not load your Momentum data: '+e.message);
  }
}

(async()=>{
  showDashboardSkeleton();
  await window.Auth.init(async(session)=>{
    if(!session){
      _dataCache={};_habitsCache={};_lastRenderedCache={};
      hideDashboardSkeleton();
      document.body.classList.add('app-auth-locked');
      window.AuthUI.show();
      return;
    }
    document.body.classList.remove('app-auth-locked');
    window.AuthUI.hide();
    await bootMomentum();
  });
})();