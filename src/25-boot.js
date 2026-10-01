/* ================= saving ================= */
const saveState={doc:null,status:'Saved on this device only.',busy:false,pending:false,allowed:false,timer:0};
let lastSimAt=Date.now();

function markDirty(){
  clearTimeout(saveState.timer);
  saveState.timer=setTimeout(saveNow,1500);
}
async function saveNow(){
  if(!S||!saveState.allowed) return;
  const json=serialize();
  try{localStorage.setItem(SAVE_KEY,json);}catch(e){}
  if(!saveState.doc) return;
  if(saveState.busy){saveState.pending=true;return;}
  saveState.busy=true;
  try{
    await saveState.doc.set({json,savedAt:S.savedAt});
    saveState.status='Saved to your account and this device.';
  }catch(e){
    saveState.status='Saved on this device. The account save did not go through.';
  }
  saveState.busy=false;
  if(saveState.pending){saveState.pending=false;saveNow();}
}

async function initRemote(){
  try{
    if(!window.claude||!window.claude.use) return null;
    const res=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    const db=res[0],user=res[1];
    if(!db||!user) return null;
    const id=await user.id();
    if(!id) return null;
    const doc=db.doc('data/users/'+id+'/tank');
    const snap=await doc.get();
    let data=null;
    if(snap.exists){
      const d=snap.data();
      if(d&&typeof d.json==='string'){try{data=JSON.parse(d.json);}catch(e){data=null;}}
    }
    return {doc,data};
  }catch(e){return null;}
}

/* ================= boot ================= */
function afterLoad(){
  JUICE_ON=false;
  const now=Date.now();
  let mins=(now-S.lastSeen)/60000;
  if(!(mins>0)) mins=0;
  if(mins>OFFLINE_CAP_MIN) mins=OFFLINE_CAP_MIN;
  lastSimAt=now;
  scene.rt.clear();scene.food.length=0;
  let ev=null;
  if(mins>0.05) ev=simulate(mins);
  S.lastSeen=now;
  buildNav();
  for(const f of S.fish) discover(f);
  JUICE_Q.length=0;JUICE_ON=true;
  scene.vw=scene.va=scene.pileN=null;
  snapCoins();
  setTab(curTab);
  refreshActive();
  if(ev&&mins>=5) showAway(mins,ev);
  else if(!S.seenWelcome){S.seenWelcome=true;S.news=NEWS_V;openSheet('welcome');}
  else if((S.news||0)<NEWS_V){const prev=S.news||0;S.news=NEWS_V;openSheet('news',prev);}
}
function tick(){
  if(!S) return;
  const now=Date.now();
  let mins=(now-lastSimAt)/60000;
  lastSimAt=now;
  if(!(mins>0)) return;
  if(mins>OFFLINE_CAP_MIN) mins=OFFLINE_CAP_MIN;
  const hatchedBefore=S.stats.hatched;
  const ev=simulate(mins);
  if(mins>=5) JUICE_Q.length=0;
  if(mins>=5&&!sheetState) showAway(mins,ev);
  else{
    if(ev.reverted&&ev.reverted.length){toast(`${ev.reverted[0]} turned back into a polyp! Cool the tank to bring it back.`);sfx.chime();}
    else if(ev.released){toast(`${ev.released} baby ${ev.released>1?'jellies':'jelly'} budded off! Warm the tank back up when you are ready.`);sfx.hatch();}
    else if(ev.settled){toast('A larva settled as a polyp colony.');sfx.hatch();}
    else if(S.stats.hatched>hatchedBefore){toast(`${S.stats.hatched-hatchedBefore} new ${S.stats.hatched-hatchedBefore>1?'babies':'baby'} hatched!`);sfx.hatch();}
    if(ev.sick){toast('Someone is feeling sick. Check the tank.');sfx.sick();}
  }
  refreshActive();
  flushJuice();
}
function loadLocal(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const o=JSON.parse(raw);
    return (o&&Array.isArray(o.fish))?o:null;
  }catch(e){return null;}
}
async function start(){
  sceneInit();
  buildNav();
  $('#tankHint').textContent='Filling the tank...';
  const local=loadLocal();
  let remote=null,remoteDone=false;
  const rp=initRemote().then(r=>{remote=r;remoteDone=true;return r;});
  await Promise.race([rp,new Promise(r=>setTimeout(r,2500))]);
  let src=local;
  if(remote){
    saveState.doc=remote.doc;
    saveState.status='Saved to your account and this device.';
    if(remote.data&&(!local||(remote.data.savedAt||0)>(local.savedAt||0)+1000)) src=remote.data;
  }
  if(src&&Array.isArray(src.fish)) S=normalize(src); else newGame();
  saveState.allowed=true;
  afterLoad();
  sceneStart();
  setInterval(tick,2000);
  setInterval(saveNow,45000);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){sceneStop();saveNow();try{if(SND.ctx&&SND.ctx.state==='running') SND.ctx.suspend();}catch(e){}}
    else{sceneStart();tick();audioResume();}
  });
  window.addEventListener('pagehide',saveNow);
  ['pointerdown','touchend','keydown'].forEach(n=>document.addEventListener(n,audioResume,{passive:true}));
  if(!remoteDone){
    rp.then(r=>{
      if(!r) return;
      saveState.doc=r.doc;
      saveState.status='Saved to your account and this device.';
      if(r.data&&(r.data.savedAt||0)>(S.savedAt||0)+1000){
        S=normalize(r.data);afterLoad();toast('Loaded your saved tank.');
      }else saveNow();
    });
  }
}
function boot(startFn){
  try{
    const h=window.claude&&window.claude.hot;
    if(h&&h.ready) h.ready(()=>startFn());
    else startFn();
  }catch(e){startFn();}
}
/* offline support: only on a real web address, never on file:// or inside the Claude sandbox */
try{
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&!window.claude){
    window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
  }
}catch(e){}
boot(start);
