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

// QUESTIONS
const QS=[
  {cat:'SLEEP',     text:'Sleep quality',           key:'sleep',     opts:['Poor sleep','Decent rest','Deep & full'],           w:[0,4,7]},
  {cat:'MORNING',   text:'Wake-up time',             key:'wake',      opts:['After 10am','8–10am','Before 8am'],                w:[-4,3,6]},
  {cat:'MORNING',   text:'Morning feel',             key:'morning',   opts:['Rough start','Okay','Sharp & clear'],              w:[-2,1,4]},
  {cat:'MORNING',   text:'Shower before noon',       key:'shower',    opts:['Skipped','Evening','Before noon'],                 w:[0,2,5]},
  {cat:'MORNING',   text:'Skincare + medication',    key:'skincare',  opts:['Skipped','Partial','Fully done'],                  w:[0,1,3]},
  {cat:'BODY',      text:'Gym / workout',            key:'gym',       opts:['Rest day','Light movement','Full session'],        w:[0,3,8]},
  {cat:'BODY',      text:'Heavy meal (bulking)',      key:'meals',     opts:['Skipped / under-ate','Light eating','Hit macros'], w:[-2,1,4]},
  {cat:'BODY',      text:'Creatine + protein',       key:'supps',     opts:['Skipped both','One of two','Both done'],           w:[0,1,3]},
  {cat:'KILLERS',   text:'Doomscrolling',            key:'doom',      opts:['Heavy scrolling','Some scrolling','None at all'],  w:[-12,-6,0]},
  {cat:'DEEP WORK', text:'Started work before noon', key:'work_noon', opts:["Didn't start",'After noon','Before noon'],        w:[-3,2,5]},
  {cat:'DEEP WORK', text:'Productive deep work',     key:'deep_work', opts:['None','Partial session','Full block'],             w:[-6,2,8]},
  {cat:'GROWTH',    text:'Reading',                  key:'reading',   opts:['None','A little','30+ min'],                      w:[0,1,3]},
  {cat:'GROWTH',    text:'Mindfulness / stillness',  key:'mind',      opts:['None','Brief','Dedicated'],                       w:[0,2,4]},
  {cat:'REFLECTION',text:'Mood today',              key:'mood',      opts:['Low / anxious','Neutral','Positive & clear'],      w:[-2,1,3]},
  {cat:'REFLECTION',text:'Overall day',             key:'overall',   opts:['Degenerate','Average','Excellent'],                w:[-4,0,6]},
];

// ENGINE
function runEngine(answers,prevV,posS,negS){
  let thrust=0,drag=0,thrustItems=[],dragItems=[];
  QS.forEach(q=>{
    if(answers[q.key]===undefined||answers[q.key]===null) return;
    const idx=(parseInt(answers[q.key])||1)-1;
    const score=q.w[Math.max(0,Math.min(2,idx))];
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
    cache[row.date]={answers:row.answers,computed:c,partial:ac<QS.length,answeredCount:ac};
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
}

// DEV TOGGLE
function showDashboardSkeleton(){
  document.getElementById('dashboard-content').classList.add('is-loading');
}
function hideDashboardSkeleton(){
  document.getElementById('dashboard-content').classList.remove('is-loading');
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
let activeQueue=[];   // always all 15 question indices, in order
let _resumeMode=false; // true = jump to first unanswered on open (begin/resume flow); false = stay at 0 (update flow)
let _dataCache=null;   // shared in-memory cache, refreshed after every write — avoids refetch glitches

function buildQueue(){return QS.map((_,i)=>i);}

function firstUnansweredIdx(){
  for(let i=0;i<activeQueue.length;i++){
    if(answers[QS[activeQueue[i]].key]===undefined) return i;
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
  const total=activeQueue.length;
  const qIdx=activeQueue[currentQ];
  const q=QS[qIdx];
  document.getElementById('q-progress').style.width=(currentQ/total*100)+'%';
  document.getElementById('q-counter').textContent=String(currentQ+1).padStart(2,'0')+' / '+total;
  document.getElementById('q-category').textContent=q.cat;
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
  answers[QS[qIdx].key]=idx+1;
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
      btn.textContent='Resume Entry — '+te.answeredCount+'/15 answered';
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
  const stats={};
  QS.forEach(q=>{stats[q.key]={key:q.key,name:q.text,cat:q.cat,w:q.w,count:0,sumScore:0};});
  keys.forEach(dk=>{
    const entry=cache[dk];if(!entry||!entry.answers) return;
    QS.forEach(q=>{
      const raw=entry.answers[q.key];if(raw===undefined||raw===null) return;
      const score=q.w[Math.max(0,Math.min(2,(parseInt(raw)||1)-1))];
      stats[q.key].count++;stats[q.key].sumScore+=score;
    });
  });
  QS.forEach(q=>{
    const s=stats[q.key];const minW=Math.min(...q.w),maxW=Math.max(...q.w),range=maxW-minW;
    if(s.count===0){s.pct=null;return;}
    const avg=s.sumScore/s.count;s.avg=Math.round(avg*10)/10;
    s.pct=range===0?100:Math.round(((avg-minW)/range)*100);
  });
  const cats=[...new Set(QS.map(q=>q.cat))];
  const listEl=document.getElementById('habits-list');listEl.innerHTML='';
  cats.forEach(cat=>{
    const qs=QS.filter(q=>q.cat===cat);
    const header=document.createElement('div');header.className='habit-cat-header';header.textContent=cat;listEl.appendChild(header);
    qs.forEach(q=>{
      const s=stats[q.key];
      if(s.pct===null){
        const row=document.createElement('div');row.className='habit-row';
        row.innerHTML=`<div><div class="habit-name">${q.text}</div><div class="habit-name-sub">NOT YET LOGGED</div></div><div></div><div class="habit-bar-wrap" style="opacity:.3"><div class="habit-bar-fill mid" style="width:0%"></div></div>`;
        listEl.appendChild(row);return;
      }
      const bucket=s.pct>=80?'great':s.pct>=60?'good':s.pct>=40?'mid':'bad';
      const row=document.createElement('div');row.className='habit-row';
      row.innerHTML=`<div><div class="habit-name">${q.text}</div><div class="habit-name-sub">AVG ${s.avg>0?'+':''}${s.avg}</div></div><div><div class="habit-score-num ${bucket}">${s.pct}</div><div class="habit-entries">/ 100</div></div><div><div class="habit-bar-wrap"><div class="habit-bar-fill ${bucket}" style="width:${s.pct}%"></div></div></div>`;
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
    const cache=await loadCache();
    _dataCache=cache;_habitsCache=cache;_lastRenderedCache=cache;
    hideDashboardSkeleton();
    renderDashboard(cache);
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