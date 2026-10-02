/* ================= UI ================= */
let curTab='tank';
let sheetState=null;
let breedSel={a:null,b:null};
let lastActions='';
let toastTimer=0;
let bookKind='fish';
const NEWS_V=3;
let devOn=false,devTaps=0,devTimer=0;
const KINDS=['fish','shrimp','jelly'];

function toast(msg,cls){
  const t=$('#toast');
  t.hidden=true;void t.offsetWidth;   /* restart the pop-in */
  t.className='toast'+(cls?' '+cls:'');t.textContent=msg;t.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},cls==='big'?3400:2600);
}

/* ---------- juice: coins, floaters, pops ---------- */
const coinView={shown:null,target:null,hold:0,raf:0};
function setCoinText(v){coinView.shown=v;$('#coins').textContent=Math.round(v);}
function bumpCoins(){
  if(REDUCED) return;
  const el=$('.coins');el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');
}
function floatText(txt,x,y,cls){
  if(REDUCED) return;
  const el=document.createElement('div');
  el.className='floatnum '+(cls||'up');el.textContent=txt;
  el.style.left=x+'px';el.style.top=y+'px';
  document.body.appendChild(el);setTimeout(()=>el.remove(),1000);
}
function coinAnchor(){const r=$('.coins').getBoundingClientRect();return [r.left+r.width/2,r.bottom+2];}
function snapCoins(){
  cancelAnimationFrame(coinView.raf);
  coinView.hold=0;coinView.shown=null;coinView.target=null;
  renderCoins();
}
/* the counter eases to whatever S.coins is, unless coins are mid-flight */
function renderCoins(){
  if(!S||coinView.hold>0) return;
  const to=S.coins;
  if(coinView.shown===null||REDUCED||document.hidden){
    cancelAnimationFrame(coinView.raf);coinView.target=to;setCoinText(to);return;
  }
  if(coinView.target===to) return;
  const from=coinView.shown,d=to-from;
  coinView.target=to;
  cancelAnimationFrame(coinView.raf);
  if(Math.abs(d)<1){setCoinText(to);return;}
  const a=coinAnchor();
  floatText((d>0?'+':'\u2212')+Math.round(Math.abs(d)),a[0],a[1],d>0?'up':'dn');
  bumpCoins();
  const t0=performance.now(),dur=clamp(260+Math.abs(d)*3,320,800);
  const step=now=>{
    const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    setCoinText(from+d*e);
    if(k<1) coinView.raf=requestAnimationFrame(step);
  };
  coinView.raf=requestAnimationFrame(step);
}
/* n coins were just added to S.coins; the counter still shows `base`. Fly them in one by one. */
function flyCoins(n,ox,oy,base){
  const tgt=$('.coins').getBoundingClientRect();
  if(REDUCED||document.hidden||!tgt.width||!Element.prototype.animate){renderCoins();return;}
  const cnt=Math.min(n,clamp(Math.round(Math.sqrt(n)*2.2),3,14));
  cancelAnimationFrame(coinView.raf);
  coinView.hold++;coinView.target=null;setCoinText(base);
  const icon=$('#coinIc').getBoundingClientRect();
  const tx=icon.left+icon.width/2,ty=icon.top+icon.height/2,share=n/cnt;
  let landed=0,released=false;
  const release=()=>{
    if(released) return;released=true;
    coinView.hold=Math.max(0,coinView.hold-1);
    if(coinView.hold===0){
      const a=coinAnchor();floatText('+'+n,a[0],a[1],'up');
      coinView.target=null;renderCoins();
    }
  };
  setTimeout(release,2600);
  for(let i=0;i<cnt;i++){
    setTimeout(()=>{
      const el=document.createElement('div');
      el.className='flycoin';el.innerHTML=ic('coin',2);
      document.body.appendChild(el);
      const w=el.offsetWidth||14,h=el.offsetHeight||14;
      const sx=ox-w/2,sy=oy-h/2,ex=tx-w/2,ey=ty-h/2;
      const mx=sx+jrnd(-34,34),my=sy-jrnd(16,46);
      const anim=el.animate([
        {transform:`translate(${sx}px,${sy}px) scale(.5)`,opacity:0.2,easing:'cubic-bezier(.2,.8,.3,1)',offset:0},
        {transform:`translate(${mx}px,${my}px) scale(1.15)`,opacity:1,easing:'cubic-bezier(.55,0,.9,.6)',offset:0.3},
        {transform:`translate(${ex}px,${ey}px) scale(.7)`,opacity:1,offset:1}
      ],{duration:jrnd(640,820),fill:'forwards'});
      anim.onfinish=()=>{
        el.remove();landed++;
        if(!released){setCoinText((coinView.shown||0)+share);sfx.ping(i);bumpCoins();}
        if(landed===cnt) release();
      };
    },i*55);
  }
}
function pileOrigin(){
  const cv=scene.cv.getBoundingClientRect();
  const x=cv.left+147/SW*cv.width,y=cv.top+(SAND_Y+8)/SH*cv.height;
  if(cv.width>0&&y>0&&y<innerHeight) return [x,y];
  const b=$('[data-act="collect"]'),r=b&&b.getBoundingClientRect();
  return r&&r.width?[r.left+r.width/2,r.top+r.height/2]:[innerWidth/2,innerHeight*0.55];
}
function popEl(el){
  if(REDUCED||!el) return;
  let t=el;
  if(!t.isConnected&&el.dataset&&el.dataset.act) t=document.querySelector('[data-act="'+el.dataset.act+'"]'+(el.dataset.id?'[data-id="'+el.dataset.id+'"]':''));
  if(!t) return;
  t.classList.remove('pop');void t.offsetWidth;t.classList.add('pop');
}
function shake(el){
  if(REDUCED||!el) return;
  el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');
}
/* celebration text from the sim: show the most exciting one, a beat after the sparkles start */
const JPRI={species:5,hyb:5,rare:4,gene:2};
function flushJuice(){
  let best=null;
  for(const e of JUICE_Q){
    if(!e.msg||e.uiDone) continue;
    e.uiDone=true;
    if(!best||(JPRI[e.kind]||0)>(JPRI[best.kind]||0)) best=e;
  }
  if(best){const m=best.msg;setTimeout(()=>toast(m,'big'),REDUCED?0:850);}
}
const coinHtml=n=>`<span class="price">${ic('coin',2)}<span>${n}</span></span>`;
const barCls=(pct,g,w)=>pct>g?'':(pct>w?'warn':'bad');
const pctW=v=>Math.round(clamp(v,0,100));
const plural=(n,one,many)=>n===1?one:(many||one+'s');
const names=(list,max)=>{
  const a=list.slice(0,max||2).map(f=>f.name).join(' and ');
  return a+(list.length>(max||2)?' and others':'');
};

function buildNav(){
  const tabs=[['tank','Tank','tank'],['fish','Crew','fish'],['breed','Breed','heart'],['shop','Shop','bag'],['book','Book','book']];
  $('#tabs').innerHTML=tabs.map(([id,label,icon])=>`<button data-act="tab" data-tab="${id}" class="${id===curTab?'on':''}" aria-label="${label}">${ic(icon,2)}<span>${label}</span><i class="dot" id="dot-${id}"></i></button>`).join('');
  $('#coinIc').innerHTML=ic('coin',2);
  $('#brandIc').innerHTML=ic('fish',2);
  $('#btnSettings').innerHTML=ic('gear',2);
  renderSoundBtn();
}
function renderSoundBtn(){
  const off=!!(S&&!S.sound);
  const b=$('#btnSound');
  b.innerHTML=ic(off?'mute':'sound',2);
  b.setAttribute('aria-label',off?'Turn sound on':'Turn sound off');
  b.setAttribute('aria-pressed',off?'false':'true');
}
function setTab(name){
  curTab=name;
  $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  $$('.tab').forEach(s=>s.classList.toggle('on',s.id==='tab-'+name));
  if(name!=='tank'&&scene.decorMode) toggleDecor(false);
  renderTab(name);
  $('#main').scrollTop=0;
}
function renderTab(name){
  if(!S) return;
  if(name==='tank') updateTankUI();
  else{
    const el=$('#tab-'+name);
    el.innerHTML=({fish:htmlFish,breed:htmlBreed,shop:htmlShop,book:htmlBook})[name]();
    paintAllCanvases(el);
  }
}
function refreshActive(){
  if(!S) return;
  renderCoins();
  $('#dot-tank').classList.toggle('on',needsAttention());
  $('#dot-breed').classList.toggle('on',S.eggs.some(e=>e.t<=0));
  if(curTab==='tank') updateTankUI();
  else if(!sheetState) renderTab(curTab);
  if(sheetState&&(sheetState.kind==='fish'||sheetState.kind==='polyp')) renderSheet(true);
}

/* ---------- tank tab ---------- */
function hintText(){
  const sick=S.fish.filter(f=>f.sick);
  if(sick.length) return `${names(sick)} ${sick.length>1?'are':'is'} sick. Give medicine and keep the water clean.`;
  const hungry=S.fish.filter(f=>f.hunger<35);
  if(hungry.length) return `${names(hungry)} ${hungry.length>1?'look':'looks'} hungry. Tap Feed.`;
  if(S.fish.some(f=>SP[f.sp].sens)&&S.waste>32) return 'Jellyfish are picky about clean water. Change some water soon.';
  if(S.waste>60) return 'The water is getting murky. Change some water.';
  if(S.filter<20) return 'The filter is clogged. Rinse it.';
  if(S.algae>60) return 'Algae is covering the glass. Give it a scrub.';
  const chilling=S.polyps.filter(p=>p.chill>0&&p.size>=2);
  if(chilling.length){
    const best=Math.max(...chilling.map(p=>p.chill));
    return `Your polyps are cooling down, ${pctW(100*best/POLYP_CHILL_MIN)}% of the way. Warm the tank back up once baby jellies appear.`;
  }
  const off=S.fish.filter(f=>tempOff(f)>0.5);
  if(off.length) return `${off[0].name}${off.length>1?' and others are':' is'} not comfy at ${S.temp.toFixed(0)}°C. Try a different heater setting.`;
  const ready=S.eggs.filter(e=>e.t<=0);
  if(ready.length){
    return ready[0].kids.every(k=>viaPolyp(k.sp))?'Larvae are ready to settle, but the polyp bed is full.':'Eggs are ready to hatch, but the tank is full. Make room.';
  }
  if(S.pile>=1) return `${Math.floor(S.pile)} ${plural(Math.floor(S.pile),'coin is','coins are')} waiting. Tap the pile or Collect.`;
  if(!S.fish.length) return 'Your tank is empty. Visit the shop to get your first fish.';
  if(S.polyps.some(p=>p.size>=2)) return 'Your polyps are ready. Open one on the Crew tab to see how to wake them.';
  const inc=S.fish.reduce((a,f)=>a+incomePerHour(f),0);
  return `All calm. Tap an empty spot on the glass to say hello. Your crew earns about ${Math.round(inc)} coins an hour.`;
}
function updateTankUI(){
  const T=TANKS[S.tankLvl];
  renderCoins();
  const used=usedSpace();
  $('#tankInfo').innerHTML=`<span class="nm">${T.n}<small>${T.l}</small></span><span class="sp"><span class="bar ${barCls(100-100*used/T.cap,20,8)}"><i style="width:${pctW(100*used/T.cap)}%"></i></span>space ${fmtSpace(used)}/${T.cap}</span>`;
  $('#tankHint').textContent=hintText();
  $('#tankHint').classList.toggle('warn',needsAttention());
  const water=100-S.waste,glass=100-S.algae;
  const setBar=(id,pct,g,w)=>{const b=$('#b'+id),c=barCls(pct,g,w);b.className='bar '+c;b.firstElementChild.style.width=pctW(pct)+'%';$('#me'+id).className='meter '+c;};
  setBar('Water',water,50,30);setBar('Filter',S.filter,40,15);setBar('Glass',glass,40,20);
  $('#gTemp').querySelector('.cur').style.left=pctW(100*(S.temp-16)/16)+'%';
  $('#gTemp').querySelector('.tgt').style.left=pctW(100*(S.heater-16)/16)+'%';
  $('#mWater').textContent=pctW(water)+'%';
  $('#mFilter').textContent=pctW(S.filter)+'%';
  $('#mGlass').textContent=pctW(glass)+'%';
  $('#mTemp').textContent=S.temp.toFixed(1)+'°C';
  const comfy=S.fish.filter(f=>tempOff(f)<=0.5).length;
  const warming=Math.abs(S.temp-S.heater)>0.4;
  $('#tTemp').textContent=`Heater ${S.heater}°`+(warming?(S.temp<S.heater?' · warming up':' · cooling down'):(S.fish.length?` · ${comfy}/${S.fish.length} comfy`:''));
  const sick=sickCount();
  const n=Math.floor(S.pile);
  const extra=(sick&&S.feeder.owned)?'s6':'s12';
  const html=[
    `<button class="btn gold wide" data-act="collect" ${n<1?'disabled':''}>${ic('coin',2)}${n<1?'Coin pile is empty':'Collect '+n+' '+plural(n,'coin')}</button>`,
    `<button class="btn primary tile s3" data-act="feed" aria-label="Feed the fish"><span class="tic">${ic('food',3)}</span>Feed</button>`,
    `<button class="btn tile s3" data-act="scrub" aria-label="Scrub the glass" ${S.algae<3?'disabled':''}><span class="tic">${ic('scrub',3)}</span>Scrub</button>`,
    `<button class="btn tile s3" data-act="water" aria-label="Change the water" ${S.waste<6?'disabled':''}><span class="tic">${ic('drop',3)}</span>Water</button>`,
    `<button class="btn tile s3" data-act="rinse" aria-label="Rinse the filter" ${S.filter>95?'disabled':''}><span class="tic">${ic('filter',3)}</span>Rinse</button>`,
    sick?`<button class="btn danger two ${extra}" data-act="treat"><span class="lbl">${ic('pill',2)}Treat ${sick}</span><small>${S.meds} medicine</small></button>`:'',
    S.feeder.owned?`<button class="btn two ${extra}" data-act="refill" ${S.feeder.stock>=12||S.coins<12?'disabled':''}><span class="lbl">${ic('food',2)}Refill feeder</span><small>${S.feeder.stock}/12 · 12 coins</small></button>`:''
  ].join('');
  if(html!==lastActions){$('#actions').innerHTML=html;lastActions=html;}
  $('#decorBtn').classList.toggle('on',scene.decorMode);
  $('#decorBtn').textContent=scene.decorMode?'Done decorating':'Decorate';
}
function toggleDecor(on){
  scene.decorMode=on;
  $('#decorBtn').classList.toggle('on',on);
  $('#decorBtn').textContent=on?'Done decorating':'Decorate';
  if(on) toast('Tap the sand to place decor.');
}
function doCollect(){
  const base=S.coins;
  const n=collectPile();
  if(!n) return;
  audioResume();sfx.coin();
  const o=pileOrigin();
  burst('sparkle',147,SAND_Y+8,{n:8,cols:['#fff1a8','#ffffff','#f4c542']});
  scene.pileN=0;
  flyCoins(n,o[0],o[1],base);
  changed();
}

/* ---------- crew tab ---------- */
function moodChip(f){const m=mood(f);return `<span class="chip ${m[1]}">${m[0]}</span>`;}
function fishCard(f,extra,tag){
  return `<button class="fcard ${extra||''}" data-act="${tag||'fish'}" data-id="${f.id}">
    <div class="pic"><canvas data-fish="${f.id}" width="64" height="54"></canvas></div>
    <div class="nm">${f.name}</div>
    <div class="sub">${speciesLabel(f)} · ${stageName(f)}</div>
    <div class="chips">${moodChip(f)}${isBerried(f)?'<span class="chip good">Eggs</span>':''}</div>
    <div class="bar ${barCls(f.hunger,45,25)}" title="Hunger"><i style="width:${pctW(f.hunger)}%"></i></div>
  </button>`;
}
function polypCard(p){
  const chill=pctW(100*p.chill/POLYP_CHILL_MIN);
  return `<button class="fcard" data-act="polyp" data-id="${p.id}">
    <div class="pic"><canvas data-polyp="${p.id}" width="64" height="54"></canvas></div>
    <div class="nm">${speciesLabel(p)} polyps</div>
    <div class="sub">Colony size ${p.size.toFixed(1)}</div>
    <div class="chips">${p.size<2?'<span class="chip">Growing</span>':(chill>0?'<span class="chip ok">Cooling '+chill+'%</span>':'<span class="chip good">Ready</span>')}</div>
    <div class="bar ${chill>0?'warn':''}" title="Chill"><i style="width:${chill}%"></i></div>
  </button>`;
}
function htmlFish(){
  if(!S.fish.length&&!S.polyps.length) return `<p class="hint">Nobody here yet. Visit the shop to get your first fish.</p>`;
  const kinds=KINDS.filter(k=>S.fish.some(f=>kindOf(f)===k));
  let out=`<div class="row2"><h2 class="sec-title">Your crew · space ${fmtSpace(usedSpace())}/${capacity()}</h2></div>`;
  for(const k of kinds){
    const list=S.fish.filter(f=>kindOf(f)===k);
    out+=`${kinds.length>1?`<h2 class="sec-title">${KIND_NAMES[k]} · ${list.length}</h2>`:''}<div class="grid">${list.map(f=>fishCard(f)).join('')}</div>`;
  }
  if(S.fish.length) out+=`<p class="hint">Tap one to see its genes, its nature, or to treat or sell it.</p>`;
  if(S.polyps.length||S.fish.some(f=>viaPolyp(f.sp))){
    out+=`<h2 class="sec-title">Polyp colonies · ${S.polyps.length}/${polypCap()}</h2>`;
    out+=S.polyps.length?`<div class="grid">${S.polyps.map(polypCard).join('')}</div><p class="hint">Polyps grow slowly on the sand. Cool the tank and they bud off baby jellies.</p>`
      :`<p class="hint">Breed two adult jellies and their larvae will settle here as polyps.</p>`;
  }
  return out;
}

/* ---------- breed tab ---------- */
function selFish(id){return id?S.fish.find(f=>f.id===id)||null:null;}
function eggHtml(e){
  const ready=e.t<=0,pct=100*(1-e.t/e.total);
  const nL=e.kids.filter(k=>viaPolyp(k.sp)).length,nE=e.kids.length-nL;
  const car=e.carrier?S.fish.find(f=>f.id===e.carrier):null;
  const parts=[];
  if(nE) parts.push(`${nE} ${plural(nE,'egg')}`);
  if(nL) parts.push(`${nL} ${plural(nL,'larva','larvae')}`);
  let title=parts.join(' + ');
  if(car) title+=' carried by '+car.name;
  if(e.kids.some(k=>k.hyb)) title+=' (hybrid)';
  const where=nL&&nE?'Ready, waiting for room.':(nL?'Ready to settle, waiting for room in the polyp bed.':'Ready to hatch, waiting for room in the tank.');
  const when=nL&&!nE?'Settles as a polyp in ':'Hatches in ';
  const status=ready?where:when+fmtDur(e.t);
  return `<div class="card egg"><div class="row2"><b>${title}</b><span class="hint">${e.parents[0]} × ${e.parents[1]}</span></div>
    <div class="bar ${ready?'warn':'hp'}"><i style="width:${pctW(pct)}%"></i></div>
    <span class="hint">${status}</span></div>`;
}
function htmlBreed(){
  let a=selFish(breedSel.a),b=selFish(breedSel.b);
  if(!a) breedSel.a=null; if(!b) breedSel.b=null;
  const slot=(f,which)=>`<div class="card slot ${f?'filled':''}">${f?`<button class="fcard" style="width:100%" data-act="pick-slot" data-which="${which}"><div class="pic"><canvas data-fish="${f.id}" width="64" height="54"></canvas></div><div class="nm">${f.name}</div><div class="sub">${speciesLabel(f)}</div></button>`:`<button class="slotbtn" data-act="pick-slot" data-which="${which}"><span class="plus">${ic('plus',2)}</span>Pick ${which==='a'?'first':'second'}</button>`}</div>`;
  const block=pairBlock(a,b);
  const kind=a?kindOf(a):(b?kindOf(b):'fish');
  const same=a&&b&&kindOf(a)===kindOf(b),mixed=same&&a.sp!==b.sp;
  let pred='';
  if(same){
    const larvae=kind==='jelly'&&viaPolyp(a.sp)&&viaPolyp(b.sp);
    pred=`<div class="card pred"><h2 class="sec-title" style="margin:0">Likely ${larvae?'larvae':'offspring'}</h2>`+
      (mixed?`<div class="r"><span>Species</span><div class="chips"><span class="chip rare dom">${shortName(a.sp)} 50%</span><span class="chip rare dom">${shortName(b.sp)} 50%</span></div></div>`:'')+
      lociOf(kind).map(k=>{
        const rows=predictLocus(k,a,b);
        if(k==='sheen'&&rows.length===1&&rows[0].label==='None') return '';
        return `<div class="r"><span>${LD(kind,k).label}</span><div class="chips">${rows.map(p=>`<span class="chip ${p.rare?'rare dom':''}">${p.sw?`<i class="sw" style="background:${p.sw}"></i>`:''}${p.label} ${Math.round(p.p*100)}%</span>`).join('')}</div></div>`;
      }).join('')+
      `<p class="hint">Each gene can also mutate into a rare one, about 1 in 50 per gene.</p></div>`;
  }
  const eggs=S.eggs.map(eggHtml).join('');
  const how=[];
  if(!a&&!b) how.push('Fish lay eggs. Shrimp carry theirs. Most jellies make larvae that settle as polyps. Different species of the same kind can cross.');
  else{
    if(kind==='jelly'&&a&&SP[a.sp].direct) how.push('Comb jellies skip the polyp stage. Their eggs hatch straight into tiny comb jellies.');
    else if(kind==='jelly') how.push('Jelly larvae settle as polyp colonies. Cool the tank and the polyps bud off baby jellies with the same genes.');
    else if(kind==='shrimp') how.push('One of the pair carries the eggs until they hatch.');
    else how.push('Eggs hatch into fry that grow up in the tank.');
    if(mixed) how.push('Mixed pairs make hybrids. They are sterile, but worth more and get their own Book page.');
  }
  how.push(`Only adults can breed, and parents rest for ${fmtDur(COOLDOWN_MIN)} afterwards.`);
  return `<h2 class="sec-title">Pick a pair</h2>
    <div class="pair">${slot(a,'a')}${slot(b,'b')}<span class="pair-heart" aria-hidden="true">${ic('heart',2)}</span></div>
    ${pred}
    <button class="btn primary big" data-act="breed-go" ${block?'disabled':''}>${ic('heart',2)}${block||'Pair them up'}</button>
    <p class="tip">${how.join(' ')}</p>
    <h2 class="sec-title">Nursery · ${S.eggs.length}/${NURSERY_MAX}</h2>
    ${eggs||'<p class="hint empty">Nothing growing right now.</p>'}`;
}

/* ---------- shop tab ---------- */
function shopRow(sp){
  const room=hasRoom(sp.id),broke=S.coins<sp.price;
  const bits=[`${sp.lo}–${sp.hi}°C`];
  const quirk=sp.quirk?`<span style="color:var(--accent)">${sp.quirk}</span>`:'';
  if(sp.algae) bits.push('eats algae');
  if(sp.sens) bits.push('very clean water');
  bits.push(`${fmtSpace(sp.w)} space`);
  return `<div class="card shop-item">
      <div class="pic"><canvas data-species="${sp.id}" width="64" height="54"></canvas></div>
      <div class="txt"><b>${sp.n}</b><span>${sp.blurb}</span>${quirk}<div class="chips">${bits.map(b=>`<span class="chip">${b}</span>`).join('')}</div></div>
      <div class="buyrow"><span class="${broke?'broke':''}">${coinHtml(sp.price)}</span><button class="btn buy" data-act="buy-fish" data-id="${sp.id}" ${(broke||!room)?'disabled':''}>${!room?'No room':'Buy'}</button></div>
    </div>`;
}
function htmlShop(){
  const blurbs={fish:'',shrimp:'<p class="hint">Small, gentle and busy. They graze on algae and only need about half a spot. Pairs breed, and the mother carries the eggs.</p>',jelly:'<p class="hint">Six very different jellies. Most breed through larvae and polyps: cool the tank to make more. Comb jellies just lay eggs. All need very clean water.</p>'};
  const fishRows=KINDS.map(k=>`<h2 class="sec-title">${KIND_NAMES[k]}</h2>${blurbs[k]}${SPECIES.filter(sp=>sp.kind===k).map(shopRow).join('')}`).join('');
  const placed=id=>S.decor.slots.filter(x=>x===id).length;
  const decorRows=DECOR_DEF.map(d=>`<div class="card plain-item"><div class="txt"><b>${d.n}</b><span>${d.plant?'Plant · cleaner water · ':''}Owned ${S.decor.owned[d.id]||0}${placed(d.id)?` (${placed(d.id)} placed)`:''}</span></div>
      <button class="btn buy" data-act="buy-decor" data-id="${d.id}" ${S.coins<d.price?'disabled':''}>Buy${coinHtml(d.price)}</button></div>`).join('');
  const nt=TANKS[S.tankLvl+1],nf=FILTERS[S.filterLvl+1];
  const up=[];
  up.push(nt?`<div class="card plain-item"><div class="txt"><b>${nt.n} ${nt.l}</b><span>Space for ${nt.cap} · ${polypCap()+1} polyp spots · cleaner water</span></div><button class="btn buy" data-act="buy-tank" ${S.coins<nt.price?'disabled':''}>Upgrade${coinHtml(nt.price)}</button></div>`:`<div class="card plain-item"><div class="txt"><b>${TANKS[S.tankLvl].n}</b><span>Your tank is the biggest one.</span></div></div>`);
  up.push(nf?`<div class="card plain-item"><div class="txt"><b>${nf.n}</b><span>Stays clean for ${nf.life} hours instead of ${FILTERS[S.filterLvl].life}</span></div><button class="btn buy" data-act="buy-filter" ${S.coins<nf.price?'disabled':''}>Upgrade${coinHtml(nf.price)}</button></div>`:`<div class="card plain-item"><div class="txt"><b>${FILTERS[S.filterLvl].n}</b><span>Your filter is the best one.</span></div></div>`);
  up.push(S.feeder.owned?`<div class="card plain-item"><div class="txt"><b>Auto feeder</b><span>${S.feeder.stock}/12 portions left. Feeds a hungry one while you are away.</span></div><button class="btn buy" data-act="refill" ${(S.feeder.stock>=12||S.coins<12)?'disabled':''}>Refill +6${coinHtml(12)}</button></div>`:`<div class="card plain-item"><div class="txt"><b>Auto feeder</b><span>Feeds a hungry one while you are away. Comes with 6 portions.</span></div><button class="btn buy" data-act="buy-feeder" ${S.coins<100?'disabled':''}>Buy${coinHtml(100)}</button></div>`);
  const themeRows=THEMES.map(t=>{
    const own=S.themes&&S.themes[t.id],on=S.theme===t.id;
    return `<div class="card plain-item"><div class="txt"><b>${t.n}</b><span>${on?'In use':(own?'Owned':'Changes the water and backdrop')}</span></div>
      ${own?`<button class="btn buy" data-act="use-theme" data-id="${t.id}" ${on?'disabled':''}>${on?'In use':'Use'}</button>`:`<button class="btn buy" data-act="buy-theme" data-id="${t.id}" ${S.coins<t.price?'disabled':''}>Buy${coinHtml(t.price)}</button>`}</div>`;
  }).join('');
  return `${fishRows}
    <h2 class="sec-title">Care</h2>
    <div class="card plain-item"><div class="txt"><b>Medicine</b><span>Cures one sick friend. You have ${S.meds}.</span></div><button class="btn buy" data-act="buy-med" ${S.coins<15?'disabled':''}>Buy${coinHtml(15)}</button></div>
    ${up.join('')}
    <h2 class="sec-title">Decor</h2>${decorRows}
    <h2 class="sec-title">Water look</h2>${themeRows}`;
}

/* ---------- book tab ---------- */
function alleleChip(kind,key,i,known){
  const o=LD(kind,key).opts[i];
  if(!known) return `<span class="chip lock ${o.r?'rare':''}">${o.r?'Rare ':''}???</span>`;
  return `<span class="chip ${o.r?'rare dom':''}">${(key==='color'||key==='accent')?`<i class="sw" style="background:${o.c}"></i>`:''}${o.n}</span>`;
}
const possibleHybrids=()=>KINDS.reduce((n,k)=>{const c=SPECIES.filter(x=>x.kind===k).length;return n+c*(c-1)/2;},0);
function htmlBook(){
  let total=0,found=0;
  for(const kd of KINDS) for(const k of lociOf(kd)){total+=LD(kd,k).opts.length;found+=Object.keys(S.book.al[kd+'.'+k]||{}).length;}
  const spFound=Object.keys(S.book.sp).length;
  const morphs=Object.keys(S.book.morph).length;
  const tabs=KINDS.concat(['hyb']);
  const seg=`<div class="seg" role="group" aria-label="Collection">${tabs.map(k=>`<button data-act="book-kind" data-kind="${k}" class="${k===bookKind?'on':''}">${k==='hyb'?'Hybrids':KIND_NAMES[k]}</button>`).join('')}</div>`;
  const head=`<div class="card stat3"><div><b>${spFound}/${SPECIES.length}</b><span>Species</span></div><div><b>${found}/${total}</b><span>Genes</span></div><div><b>${morphs}</b><span>Looks</span></div></div>${seg}`;
  const foot=`<div class="card stat3"><div><b>${S.stats.bred}</b><span>Pairings</span></div><div><b>${S.stats.hybrids||0}</b><span>Hybrids</span></div><div><b>${S.stats.earned}</b><span>Coins earned</span></div></div>`;
  if(bookKind==='hyb'){
    const keys=Object.keys(S.book.hyb||{}).filter(k=>k.split(':').every(id=>SP[id])).sort();
    const cards=keys.map(k=>{
      const [a,b]=k.split(':');
      return `<div class="fcard lockd" style="cursor:default"><div class="pic"><canvas data-hyb="${a}:${b}" width="64" height="54"></canvas></div><div class="nm">${shortName(a)} × ${shortName(b)}</div><div class="sub">${KIND_NAMES[SP[a].kind]} hybrid</div></div>`;
    }).join('');
    return `${head}
      <h2 class="sec-title">Hybrids · ${keys.length}/${possibleHybrids()}</h2>
      <p class="hint">Pair two different species of the same kind. The babies are sterile, but worth more and look like a mix of both.</p>
      ${cards?`<div class="grid">${cards}</div>`:'<p class="hint">No hybrids yet. Try pairing two different fish.</p>'}
      ${foot}`;
  }
  const spCards=SPECIES.filter(sp=>sp.kind===bookKind).map(sp=>{
    const k=!!S.book.sp[sp.id];
    return `<div class="fcard lockd" style="cursor:default"><div class="pic"><canvas data-species="${sp.id}" data-sil="1" width="64" height="54"></canvas></div><div class="nm">${k?sp.n:'???'}</div><div class="sub">${k?sp.blurb:'Not collected yet'}</div></div>`;
  }).join('');
  const genes=lociOf(bookKind).map(k=>{
    const L=LD(bookKind,k),got=S.book.al[bookKind+'.'+k]||{};
    return `<div><h2 class="sec-title" style="margin-bottom:6px">${L.label} genes · ${Object.keys(got).length}/${L.opts.length}</h2><div class="chips">${L.opts.map((o,i)=>alleleChip(bookKind,k,i,!!got[i])).join('')}</div></div>`;
  }).join('');
  return `${head}
    <h2 class="sec-title">${KIND_NAMES[bookKind]} species</h2><div class="grid">${spCards}</div>
    <h2 class="sec-title">Gene collection</h2>
    <p class="hint">Rare genes only appear by mutation when you breed. They hide as carriers until two carriers meet.</p>
    <div class="lgrid">${genes}</div>
    ${foot}`;
}

/* ---------- sheets ---------- */
function openSheet(kind,arg){sheetState={kind,arg:arg??null,armed:false};renderSheet();if(kind==='settings') prepareBackup();}
function closeSheet(){
  const was=sheetState&&sheetState.kind;
  sheetState=null;$('#sheet').hidden=true;
  if(was==='away'&&S&&(S.news||0)<NEWS_V){const prev=S.news||0;S.news=NEWS_V;openSheet('news',prev);return;}
  if(curTab!=='tank') renderTab(curTab);
}
/* ---------- DNA view: one rung per trait. What shows is on the left of the rung, what hides is dim on the right ---------- */
const HX={R:44,W:60,A:18,P:3,PAD:10,TURN:5}; // row height, helix width, strand swing, pixel size, end padding, rows per full twist
const HX_SHOW='#ffb347',HX_SHEEN=['#8fa9be','#fff3a0','#f4f0ff'];
let hxRows=null,hxPhase=0.6,hxRaf=0,hxLast=0;
/* one trait for the player: what shows, and any gene it carries without showing */
function geneInfo(f,k){
  const L=LD(kindOf(f),k),pair=f.g[k],o=L.opts,isCol=k==='color'||k==='accent';
  const gene=i=>({n:o[i].n,c:isCol?o[i].c:(k==='sheen'?HX_SHEEN[i]:HX_SHOW),sw:isCol?o[i].c:null,rare:!!o[i].r});
  if(k==='size') return {label:L.label,shown:{n:SIZE_NAMES[pair[0]+pair[1]],c:HX_SHOW,sw:null,rare:false},hidden:[],note:pair[0]!==pair[1]?o[pair[0]].n+' + '+o[pair[1]].n:''};
  const v=k==='sheen'?((pair[0]===pair[1]&&pair[0]>0)?pair[0]:0):expr(k,pair);
  return {label:L.label,shown:gene(v),hidden:pair.filter(i=>i!==v).map(gene),note:''};
}
/* the helix itself, drawn as chunky pixels. phase turns it. */
function helixInner(rows,phase){
  const {R,W,A,P,PAD,TURN}=HX,H=rows.length*R+PAD*2,cx=W/2;
  const th=y=>(y-PAD)/(R*TURN)*Math.PI*2+phase;
  const snap=v=>Math.round(v/P)*P;
  const px=(x,y,w,h,cls,extra)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${cls?`class="${cls}"`:''} ${extra||''}/>`;
  let back='',front='';
  for(let y=0;y<H;y+=P){
    const t=th(y+P/2),c=Math.cos(t)*A,aFront=Math.sin(t)>0;
    const xa=snap(cx+c)-P,xb=snap(cx-c)-P;
    front+=px(aFront?xa:xb,y,P*2,P,'hx-f');
    back+=px(aFront?xb:xa,y,P*2,P,'hx-b');
  }
  let rungs='',pads='';
  rows.forEach((r,i)=>{
    const y=snap(PAD+i*R+R/2),half=Math.max(P*3,Math.abs(Math.cos(th(y)))*A);
    const xl=snap(cx-half),xr=snap(cx+half);
    const sides=[{g:r.shown,dim:false},r.hidden.length?{g:r.hidden[0],dim:true}:{g:r.shown,dim:false}];
    sides.forEach((s,side)=>{
      const glint=s.g.rare?0.8+0.2*Math.sin(phase*4+i):1;
      const op=((s.dim)?0.4:1)*glint;
      const x0=side?cx:xl,w=side?xr-cx:cx-xl,xe=side?xr:xl;
      rungs+=px(x0,y-P,w,P*2,'',`fill="${s.g.c}" opacity="${op.toFixed(2)}"`);
      pads+=px(xe-P,y-P*2,P*2,P*4,'',`fill="${s.g.c}" opacity="${op.toFixed(2)}"`);
    });
  });
  return back+rungs+front+pads;
}
function geneBlock(f){
  const rows=lociOf(kindOf(f)).map(k=>geneInfo(f,k));
  hxRows=rows;
  const {W,R,PAD}=HX,H=rows.length*R+PAD*2;
  const sw=g=>g.sw?`<i class="sw" style="background:${g.sw}"></i>`:'';
  const body=rows.map(r=>{
    const s=r.shown;
    const hid=r.hidden.length?`<span class="hx-hid${r.hidden.some(g=>g.rare)?' rare':''}">carries ${r.hidden.map(g=>sw(g)+g.n).join(' + ')}</span>`:(r.note?`<span class="hx-hid">${r.note}</span>`:'');
    return `<div class="hx-row"><span class="hx-k">${r.label}</span><span class="hx-v"><b${s.rare?' class="rare"':''}>${sw(s)}${s.n}${s.rare?'<small>rare</small>':''}</b>${hid}</span></div>`;
  }).join('');
  return `<div class="kv"><h2 class="sec-title" style="margin:0">Genes</h2>
      <p class="hint">Each trait has two genes. One shows. The other can hide, and babies can still get it.</p>
      <div class="helix"><svg class="hx-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" aria-hidden="true">${helixInner(rows,hxPhase)}</svg>${body}</div></div>`;
}
/* slow twist while a creature sheet is open */
function hxTick(now){
  hxRaf=0;
  const el=document.querySelector('.hx-svg');
  if(!el||!hxRows) return;
  if(now-hxLast>=70){hxLast=now;hxPhase+=0.055;el.innerHTML=helixInner(hxRows,hxPhase);}
  hxRaf=requestAnimationFrame(hxTick);
}
function hxStart(){if(!hxRaf&&!REDUCED&&document.querySelector('.hx-svg')) hxRaf=requestAnimationFrame(hxTick);}
function creatureHabits(f){
  const kind=kindOf(f),floor=SP[f.sp].floor;
  const place=kind==='jelly'?preferredDepthLabel(f):favoritePlaceLabel(f);
  const greeting=kind==='fish'?{
    shy:'Hangs back at first, then comes closer slowly.',bold:'Swims over to see you.',
    greedy:'Checks for a snack, then goes exploring.',lazy:'Watches you from a comfy distance.',
    social:'Comes close and stays a little while.',playful:'Eager to come over and investigate.'
  }[f.trait]:kind==='shrimp'?{
    shy:'Freezes, takes a small step back, then cautiously returns.',bold:'Pauses, steps aside and soon resumes exploring.',
    greedy:'Pauses briefly, then gets back to foraging.',lazy:'Stays still a little longer before carrying on.',
    social:'Pauses and steps aside, then returns to its little patch.',playful:'Takes a quick little step back, then slowly comes back.'
  }[f.trait]:floor?'Keeps resting on the sand, with a gentle change of pulse.':
    f.trait==='shy'?'Gently turns away, then returns to its favorite depth.':
    f.trait==='lazy'?'Keeps drifting, with a small change of pulse.':'Gently adjusts its course and pulse, then drifts on.';
  return `<div class="r"><span>${kind==='jelly'?'Favorite depth':'Favorite spot'}</span><div class="hint">${place}. ${kind==='jelly'?(floor?'A quiet place to settle.':'A familiar layer to drift back to.'):'A place to wander back to.'}</div></div>
    <div class="r"><span>Say hello</span><div class="hint">${greeting} Tap empty glass ${kind==='shrimp'?'near the sand ':''}to watch.</div></div>`;
}
function sheetFish(f){
  const sp=SP[f.sp],kind=kindOf(f),st=stageOf(f),inc=incomePerHour(f),tr=TRAIT[f.trait];
  const nextAge=st<2?fmtDur(STAGE_AGE[st]-f.age):'';
  return `<div class="hd"><h3>${f.name}</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="fish-hero"><div class="pic"><canvas data-fish="${f.id}" width="64" height="54"></canvas></div>
      <div class="kv" style="gap:6px"><b>${speciesLabel(f)}</b><span class="hint">${stageName(f)}${nextAge?' · adult in '+nextAge:''}</span><div class="chips">${moodChip(f)}${isBerried(f)?'<span class="chip good">Carrying eggs</span>':''}${f.cool>0&&st===2?`<span class="chip">Rests ${fmtDur(f.cool)}</span>`:''}</div></div></div>
    <div class="kv">
      <div class="r"><span>Food</span><div class="bar ${barCls(f.hunger,45,25)}"><i style="width:${pctW(f.hunger)}%"></i></div></div>
      <div class="r"><span>Health</span><div class="bar ${barCls(f.health,60,35)}"><i style="width:${pctW(f.health)}%"></i></div></div>
      <div class="r"><span>Nature</span><div class="hint"><b style="color:var(--fg)">${tr.n}.</b> ${kind==='fish'?tr.d:kind==='shrimp'?'A little forager with its own pace.':'A gentle drifter with its own rhythm.'}</div></div>
      ${f.hyb?`<div class="r"><span>Hybrid</span><div class="hint">Sterile, but worth more.</div></div>`:(sp.quirk?`<div class="r"><span>Quirk</span><div class="hint">${sp.quirk}</div></div>`:'')}
      ${creatureHabits(f)}
      <div class="r"><span>Likes</span><div class="hint">${rangeOf(f).lo}–${rangeOf(f).hi}°C${sp.sens?' · very clean water':''}</div></div>
      <div class="r"><span>Worth</span><div>${coinHtml(fishValue(f))}</div></div>
      <div class="r"><span>Earns</span><div class="hint">${inc>0?inc.toFixed(1)+' coins an hour':(st<1?'Starts when it is a juvenile':'Nothing while hungry or sick')}</div></div>
    </div>
    ${geneBlock(f)}
    <div class="actions">
      ${f.sick?`<button class="btn danger two" data-act="treat-one" data-id="${f.id}"><span class="lbl">${ic('pill',2)}Treat</span><small>${S.meds} medicine</small></button>`:''}
      <button class="btn ${sheetState.armed?'danger':''}" data-act="sell" data-id="${f.id}">${sheetState.armed?'Tap again to sell for '+sellPrice(f):'Sell for '+sellPrice(f)}</button>
    </div>`;
}
function sheetPolyp(p){
  const cold=coldOf(p),pct=pctW(100*p.chill/POLYP_CHILL_MIN),grown=p.size>=2;
  const cooled=S.temp<=cold+0.2;
  let status;
  if(S.waste>=60) status='The water is too dirty for the colony to grow. Change some water.';
  else if(!grown) status=`Still growing. It needs a colony size of 2 before it can bud (${p.size.toFixed(1)} now).`;
  else if(cooled) status=`Cold enough. Keep it cool for ${fmtDur(Math.max(0,POLYP_CHILL_MIN-p.chill))} more and baby jellies will bud off.`;
  else status=`Cool the tank to ${cold}°C or lower and hold it for ${fmtDur(POLYP_CHILL_MIN)}. Then baby jellies bud off.`;
  const room=hasRoom(p.sp);
  return `<div class="hd"><h3>${speciesLabel(p)} polyps</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="fish-hero"><div class="pic"><canvas data-polyp="${p.id}" width="64" height="54"></canvas></div>
      <div class="kv" style="gap:6px"><b>Polyp colony</b><span class="hint">${p.was?p.was+' turned back into a polyp. Cool the tank to bring them back.':'Tiny jellies that stay on the sand and copy themselves.'}</span></div></div>
    <div class="kv">
      <div class="r"><span>Size</span><div class="bar"><i style="width:${pctW(100*p.size/8)}%"></i></div></div>
      <div class="r"><span>Chill</span><div class="bar ${pct>0?'warn':''}"><i style="width:${pct}%"></i></div></div>
    </div>
    <p class="hint">${status}${room?'':' Babies also need room in the tank.'}</p>
    <div class="actions">
      <button class="btn" data-act="heat-set" data-t="${cold}" ${S.heater<=cold?'disabled':''}>Cool to ${cold}°C</button>
      <button class="btn" data-act="heat-set" data-t="25" ${S.heater===25?'disabled':''}>Back to 25°C</button>
    </div>
    <p class="hint">Heads up: cold water makes warm-loving fish chilly. Warm the tank back up after the babies appear.</p>
    ${geneBlock({sp:p.sp,g:p.g,hyb:p.hyb})}
    <button class="btn ${sheetState.armed?'danger':''}" data-act="polyp-remove" data-id="${p.id}">${sheetState.armed?'Tap again to remove this colony':'Remove colony'}</button>`;
}
function sheetPick(which){
  const other=selFish(breedSel[which==='a'?'b':'a']);
  const list=S.fish.filter(f=>!other||f.id!==other.id);
  const cards=list.map(f=>{
    const why=breedBlock(f)||((other&&kindOf(other)!==kindOf(f))?'Different kind':'');
    return `<button class="fcard ${why?'lockd':''}" data-act="pick-choose" data-id="${f.id}" data-which="${which}" ${why?'disabled':''}>
      <div class="pic"><canvas data-fish="${f.id}" width="64" height="54"></canvas></div><div class="nm">${f.name}</div><div class="sub">${speciesLabel(f)}</div>
      <div class="chips">${why?`<span class="chip warn">${why}</span>`:'<span class="chip good">Ready</span>'}</div></button>`;
  }).join('');
  return `<div class="hd"><h3>Pick one of your crew</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    ${list.length?`<div class="grid">${cards}</div>`:'<p class="hint">Nobody else to pick.</p>'}
    ${breedSel[which]?`<button class="btn" data-act="pick-clear" data-which="${which}">Clear this slot</button>`:''}`;
}
function sheetDecor(i){
  const cur=S.decor.slots[i];
  const avail=DECOR_DEF.filter(d=>(S.decor.owned[d.id]||0)-S.decor.slots.filter(x=>x===d.id).length>0);
  return `<div class="hd"><h3>Sand spot ${i+1}</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    ${cur?`<p class="hint">Now: ${DECOR[cur].n}</p>`:'<p class="hint">This spot is empty.</p>'}
    <div class="actions">${avail.map(d=>`<button class="btn" data-act="place-decor" data-id="${d.id}" data-slot="${i}">${d.n}</button>`).join('')}</div>
    ${avail.length?'':'<p class="hint">You have no spare decor. Buy some in the shop.</p>'}
    ${cur?`<button class="btn danger" data-act="place-decor" data-id="" data-slot="${i}">Remove ${DECOR[cur].n}</button>`:''}`;
}
function sheetAway(a){
  const ev=a.ev,lines=[];
  const c=Math.floor(ev.coins);
  if(c>=1) lines.push(`<li>Your crew made <b>${c}</b> ${plural(c,'coin')}. They are in the pile, ready to collect.</li>`);
  else lines.push(`<li>Not many coins this time. Hungry or sick creatures do not earn.</li>`);
  if(ev.hatched) lines.push(`<li><b>${ev.hatched}</b> ${ev.hatched>1?'babies hatched':'baby hatched'}.</li>`);
  if(ev.settled) lines.push(`<li><b>${ev.settled}</b> ${plural(ev.settled,'larva settled','larvae settled')} as polyps.</li>`);
  if(ev.released) lines.push(`<li><b>${ev.released}</b> baby ${plural(ev.released,'jelly')} budded off the polyps. Warm the tank back up when you like.</li>`);
  if(ev.grown) lines.push(`<li><b>${ev.grown}</b> grew up a stage.</li>`);
  if(ev.reverted&&ev.reverted.length) lines.push(`<li><b>${ev.reverted.join(' and ')}</b> turned back into ${ev.reverted.length>1?'polyps':'a polyp'}. Cool the tank and they will come back.</li>`);
  if(ev.fed) lines.push(`<li>The auto feeder gave out ${ev.fed} ${plural(ev.fed,'portion')}.</li>`);
  if(ev.sick) lines.push(`<li><b>${ev.sick}</b> got sick.</li>`);
  const hungry=S.fish.filter(f=>f.hunger<35).length;
  if(hungry) lines.push(`<li>${hungry} ${hungry>1?'are':'is'} hungry.</li>`);
  lines.push(`<li>Water is ${pctW(100-S.waste)}% clean, filter at ${pctW(S.filter)}%, glass ${pctW(100-S.algae)}% clear.</li>`);
  return `<div class="hd"><h3>Welcome back</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="hint">${a.label}</p><ul class="tidy">${lines.join('')}</ul>
    <button class="btn primary" data-act="close">Check on the tank</button>`;
}
/* ---------- backup code: move or rescue your tank as plain text ---------- */
const bkEsc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const bkBad=m=>{const e=new Error(m);e.userMsg=m;return e;};
function bkB64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function bkUnB64(str){const s=atob(str),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i);return u;}
async function makeBackupCode(){
  const bytes=new TextEncoder().encode(serialize());
  if(typeof CompressionStream!=='undefined'){
    try{
      const cs=new CompressionStream('gzip'),w=cs.writable.getWriter();
      w.write(bytes);w.close();
      return 'FIN1z:'+bkB64(new Uint8Array(await new Response(cs.readable).arrayBuffer()));
    }catch(e){}
  }
  return 'FIN1:'+bkB64(bytes);
}
async function readBackupCode(text){
  const m=/^FIN1(z?):([A-Za-z0-9+/=]+)$/.exec(String(text||'').replace(/\s+/g,''));
  if(!m) throw bkBad('That does not look like a Finlings backup code.');
  let bytes;
  try{bytes=bkUnB64(m[2]);}catch(e){throw bkBad('The code is damaged. Check that you copied all of it.');}
  if(m[1]==='z'){
    if(typeof DecompressionStream==='undefined') throw bkBad('This browser cannot open that code.');
    const ds=new DecompressionStream('gzip'),w=ds.writable.getWriter();
    w.write(bytes);w.close();
    bytes=new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  let o;
  try{o=JSON.parse(new TextDecoder().decode(bytes));}catch(e){throw bkBad('The code is damaged. Check that you copied all of it.');}
  if(!o||!Array.isArray(o.fish)) throw bkBad('That code is not from Finlings.');
  return o;
}
function prepareBackup(){
  makeBackupCode().then(c=>{if(sheetState&&sheetState.kind==='settings') sheetState.code=c;}).catch(()=>{});
}
function backupHtml(){
  const b=sheetState;
  return `<div class="kv"><h2 class="sec-title" style="margin:0">Backup</h2>
    <p class="hint">Your tank is stored on this device. A backup code lets you move it to another device, or get it back if the app is ever wiped. Keep it in Notes or email it to yourself.</p>
    <div class="actions"><button class="btn" data-act="backup-copy">Copy backup code</button><button class="btn ${b.restore?'primary':''}" data-act="backup-restore-open">Restore from code</button></div>
    ${b.showCode&&b.code?`<textarea class="codebox" readonly rows="4" onfocus="this.select()" aria-label="Your backup code">${bkEsc(b.code)}</textarea>`:''}
    ${b.restore?`<textarea class="codebox" id="restoreBox" rows="4" placeholder="Paste your backup code here" aria-label="Paste a backup code">${bkEsc(b.restoreText||'')}</textarea>
    <button class="btn ${b.pending?'danger':'primary'}" data-act="backup-restore-go">${b.pending?'Tap again to replace this tank':'Restore this tank'}</button>`:''}
    ${b.msg?`<p class="hint">${bkEsc(b.msg)}</p>`:''}</div>`;
}
function backupCopy(){
  const st=sheetState;if(!st) return;
  const shown=ok=>{
    if(sheetState!==st) return;
    st.showCode=true;
    st.msg=ok?'Copied. Paste it somewhere safe, like Notes.':'Tap the box, then copy the code and keep it somewhere safe.';
    renderSheet(true);
  };
  const go=code=>{
    st.code=code;
    let p=null;
    try{p=navigator.clipboard.writeText(code);}catch(e){}
    if(p&&p.then) p.then(()=>shown(true),()=>shown(false)); else shown(false);
  };
  if(st.code) go(st.code);
  else makeBackupCode().then(go).catch(()=>{toast('Could not make a backup code.');sfx.error();});
}
async function backupRestoreGo(){
  const st=sheetState;if(!st) return;
  if(st.pending){const o=st.pending;closeSheet();applyRestored(o);return;}
  try{
    const box=$('#restoreBox');
    st.restoreText=box?box.value:(st.restoreText||'');
    if(st.restoreText.length>3000000) throw bkBad('That code is too long to be a Finlings backup.');
    const o=await readBackupCode(st.restoreText);
    st.pending=o;
    st.msg=`Found a tank with ${o.fish.length} ${plural(o.fish.length,'creature')} and ${Math.floor(+o.coins||0)} coins. Restoring replaces the tank you have now.`;
  }catch(e){
    st.pending=null;
    st.msg=(e&&e.userMsg)||'That code did not work. Check that you pasted all of it.';
    sfx.error();
  }
  if(sheetState===st) renderSheet(true);
}
function applyRestored(o){
  JUICE_ON=false;
  S=normalize(o);
  S.lastSeen=Date.now();S.seenWelcome=true;
  breedSel={a:null,b:null};
  scene.rt.clear();scene.food.length=0;scene.parts.length=0;scene.ripples.length=0;
  scene.vw=scene.va=scene.pileN=null;scene.wipe=scene.swirl=scene.rinse=null;
  lastSimAt=Date.now();
  afterLoad();
  saveNow();
  toast('Tank restored.');
}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='restoreBox'&&sheetState) sheetState.restoreText=e.target.value;});
function sheetSettings(){
  return `<div class="hd"><h3 data-act="dev-tap">Settings</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="kv"><h2 class="sec-title" style="margin:0">Saving</h2><p class="hint">${saveState.status}</p></div>
    ${backupHtml()}
    ${devOn?`<div class="kv"><h2 class="sec-title" style="margin:0">Developer</h2><p class="hint">Test tools. Time jumps forward on the spot.</p>
    <div class="actions"><button class="btn" data-act="ff" data-m="60">+1 hour</button><button class="btn" data-act="ff" data-m="480">+8 hours</button><button class="btn" data-act="ff" data-m="1440">+1 day</button></div></div>`:''}
    <div class="kv"><h2 class="sec-title" style="margin:0">Start over</h2>
    <button class="btn ${sheetState.armed?'danger':''}" data-act="reset">${sheetState.armed?'Tap again to erase everything':'Erase this tank'}</button></div>`;
}
function sheetWelcome(){
  return `<div class="hd"><h3>Your first tank</h3></div>
    <ul class="tidy"><li>Your crew earns coins while you are away. Tap the <b>coin pile</b> on the sand (or Collect) to pick them up.</li>
    <li>Tap <b>Feed</b> and watch them eat. Extra food sinks and dirties the water.</li>
    <li>Change water and rinse the filter now and then. Hungry ones or dirty water make them sick, and medicine fixes that. Nobody dies.</li>
    <li>Adults of the same species can breed. Shrimp and jellyfish are in the shop too, and jellies have a secret life cycle.</li></ul>
    <button class="btn primary" data-act="close">Start</button>`;
}
function sheetNews(prev){
  prev=prev||0;
  const juice=`<li><b>Juicier tank:</b> coins fly into your counter, fish wiggle and squish when they eat or get tapped, and splashes, ripples and confetti pop up when something special happens.</li>
    <li><b>Tap the water</b> to make a ripple. Friendly fish swim over to check it out.</li>
    <li><b>Cleaning</b> is more fun too: the glass gets a real scrub and a water change swirls fresh water in.</li>`;
  const v2=`<li><b>Hybrids:</b> pair two different species of the same kind. The babies are sterile, but worth more, and they get their own page in the Book.</li>
    <li><b>Six new jellies:</b> Moon (flat saucer), Sea nettle (long streamers), Upside-down (flower on the sand), Comb (rainbow rows, lays eggs, no polyps), Immortal (tiny, turns back into a polyp instead of getting sick) and Box (fast, and other swimmers keep away).</li>
    <li>Old Lantern jellies became Sea nettles.</li>`;
  const v1=`<li><b>Coin pile:</b> earnings now collect on the sand. Tap the pile or the gold button.</li>
    <li><b>Shrimp:</b> cherry, ghost and amano. They graze algae, molt, and mothers carry eggs.</li>
    <li><b>Personalities:</b> each one is shy, bold, greedy, lazy, social or playful. Tap one to say hi.</li>
    <li>The skip-ahead button is gone. Real time only now.</li>
    <li><b>Jellyfish life cycle:</b> breed larvae, let them settle as polyps, then cool the tank to bud off baby jellies.</li>`;
  return `<div class="hd"><h3>What is new</h3><button class="x" data-act="close" aria-label="Close">\u00d7</button></div>
    <ul class="tidy">${juice}${prev<2?v2:''}${prev<1?v1:''}</ul>
    <button class="btn primary" data-act="close">Nice</button>`;
}
function renderSheet(soft){
  if(!sheetState) return;
  const {kind,arg}=sheetState;
  let html='';
  if(kind==='fish'){const f=selFish(arg);if(!f){closeSheet();return;}html=sheetFish(f);}
  else if(kind==='polyp'){const p=S.polyps.find(x=>x.id===arg);if(!p){closeSheet();return;}html=sheetPolyp(p);}
  else if(kind==='pick') html=sheetPick(arg);
  else if(kind==='decor') html=sheetDecor(arg);
  else if(kind==='away') html=sheetAway(arg);
  else if(kind==='settings') html=sheetSettings();
  else if(kind==='welcome') html=sheetWelcome();
  else if(kind==='news') html=sheetNews(arg);
  const p=$('#sheetPanel');
  const st=p.scrollTop;
  p.innerHTML=html;
  $('#sheet').hidden=false;
  paintAllCanvases(p);
  hxStart();
  if(soft) p.scrollTop=st;
}

/* ---------- actions ---------- */
function changed(){
  refreshActive();
  flushJuice();
  markDirty();
}
function buyFish(id){
  const sp=SP[id];
  if(S.coins<sp.price){sfx.error();return toast('Not enough coins yet.');}
  if(!hasRoom(id)){sfx.error();return toast(`No room. Space is ${fmtSpace(usedSpace())}/${capacity()}. Sell one or upgrade.`);}
  sfx.buy();
  S.coins-=sp.price;
  const f=addFish(makeFish(id,founderGenes(sp.kind),STAGE_AGE[1]+30));
  qJuice({kind:'arrive',id:f.id});
  toast(`${f.name} the ${sp.n} joined your tank!`);
  changed();
}
function breedToast(r,egg){
  const n=r.n;
  let t;
  if(r.kind==='jelly'&&r.poly&&!r.direct) t=`${n} ${plural(n,'larva','larvae')} drifting off to settle. Polyps in ${r.total} minutes.`;
  else if(r.kind==='shrimp'){
    const car=egg&&egg.carrier?S.fish.find(f=>f.id===egg.carrier):null;
    t=`${car?car.name+' is':'She is'} carrying ${n} eggs. They hatch in ${r.total} minutes.`;
  }else t=`${n} eggs laid! They hatch in ${r.total} minutes.`;
  return r.mixed?t+' Hybrids!':t;
}
function onAct(el){
  const act=el.dataset.act,id=el.dataset.id;
  switch(act){
    case 'tab': sfx.tab();setTab(el.dataset.tab);break;
    case 'collect': doCollect();break;
    case 'feed': if(!S.fish.length){toast('Nobody to feed yet.');sfx.error();shake(el);} else if(!feedFlakes()){toast('Plenty of food in there already.');sfx.error();shake(el);} else sfx.feed();break;
    case 'scrub': sfx.scrub();scrubFx();S.algae=0;toast('The glass is sparkling.');changed();break;
    case 'water': sfx.water();swirlFx();S.waste=Math.max(3,S.waste*0.12);toast('Fresh water in.');changed();break;
    case 'rinse': sfx.rinse();rinseFx();S.filter=100;toast('Filter rinsed.');changed();break;
    case 'heat-up': S.heater=clamp(S.heater+1,16,32);changed();break;
    case 'heat-dn': S.heater=clamp(S.heater-1,16,32);changed();break;
    case 'heat-set': {
      S.heater=clamp(+el.dataset.t,16,32);
      toast(`Heater set to ${S.heater}°C.`);
      changed();renderSheet(true);break;
    }
    case 'treat': {
      let n=0;
      for(const f of S.fish){if(f.sick&&S.meds>0){f.sick=false;f.health=70;S.meds--;n++;qJuice({kind:'heal',id:f.id});}}
      if(n) sfx.heal(); else sfx.error();
      toast(n?`Treated ${n}.`:'You are out of medicine. Buy some in the shop.');
      changed();break;
    }
    case 'treat-one': {
      const f=selFish(+id);
      if(f&&S.meds>0){f.sick=false;f.health=70;S.meds--;sfx.heal();qJuice({kind:'heal',id:f.id});toast(`${f.name} is feeling better.`);}
      else{sfx.error();toast('You are out of medicine. Buy some in the shop.');}
      changed();renderSheet(true);break;
    }
    case 'decor-mode': toggleDecor(!scene.decorMode);break;
    case 'fish': openSheet('fish',+id);break;
    case 'polyp': openSheet('polyp',+id);break;
    case 'polyp-remove': {
      if(!sheetState.armed){sheetState.armed=true;renderSheet(true);break;}
      S.polyps=S.polyps.filter(p=>p.id!==+id);
      closeSheet();toast('Colony removed.');changed();break;
    }
    case 'close': closeSheet();break;
    case 'sell': {
      const f=selFish(+id);if(!f) break;
      if(!sheetState.armed){sheetState.armed=true;renderSheet(true);break;}
      const rc=el.getBoundingClientRect(),base=S.coins;
      const p=sellFish(f);sfx.coin();
      flyCoins(p,rc.left+rc.width/2,rc.top+rc.height/2,base);
      breedSel.a=breedSel.a===f.id?null:breedSel.a;breedSel.b=breedSel.b===f.id?null:breedSel.b;
      closeSheet();toast(`${f.name} went to a new home for ${p} coins.`);changed();break;
    }
    case 'pick-slot': openSheet('pick',el.dataset.which);break;
    case 'pick-choose': {
      const w=el.dataset.which;breedSel[w]=+id;
      const o=w==='a'?'b':'a',of=selFish(breedSel[o]);
      if(of&&kindOf(of)!==kindOf(selFish(+id))) breedSel[o]=null;
      closeSheet();break;
    }
    case 'pick-clear': breedSel[el.dataset.which]=null;closeSheet();break;
    case 'breed-go': {
      const a=selFish(breedSel.a),b=selFish(breedSel.b);
      if(pairBlock(a,b)) break;
      const r=doBreed(a,b);sfx.breed();
      const egg=S.eggs[S.eggs.length-1];
      breedSel={a:null,b:null};
      toast(breedToast(r,egg));
      changed();renderTab('breed');break;
    }
    case 'book-kind': bookKind=el.dataset.kind;renderTab('book');break;
    case 'buy-fish': buyFish(id);renderTab('shop');break;
    case 'buy-decor': {
      const d=DECOR[id];if(S.coins<d.price) break;
      sfx.buy();S.coins-=d.price;S.decor.owned[id]=(S.decor.owned[id]||0)+1;
      toast(`${d.n} bought. Place it with Decorate on the Tank tab.`);changed();renderTab('shop');break;
    }
    case 'place-decor': {
      const i=+el.dataset.slot;S.decor.slots[i]=id||null;
      closeSheet();changed();break;
    }
    case 'buy-tank': {
      const t=TANKS[S.tankLvl+1];if(!t||S.coins<t.price) break;
      sfx.buy();S.coins-=t.price;S.tankLvl++;toast(`Upgraded to the ${t.n}.`);changed();renderTab('shop');break;
    }
    case 'buy-filter': {
      const t=FILTERS[S.filterLvl+1];if(!t||S.coins<t.price) break;
      sfx.buy();S.coins-=t.price;S.filterLvl++;S.filter=100;toast(`${t.n} installed.`);changed();renderTab('shop');break;
    }
    case 'buy-feeder': if(S.coins<100) break;sfx.buy();S.coins-=100;S.feeder.owned=true;S.feeder.stock=6;toast('Auto feeder installed with 6 portions.');changed();renderTab('shop');break;
    case 'refill': if(S.coins<12||S.feeder.stock>=12) break;sfx.buy();S.coins-=12;S.feeder.stock=Math.min(12,S.feeder.stock+6);toast('Feeder refilled.');changed();if(curTab!=='tank') renderTab(curTab);break;
    case 'buy-med': if(S.coins<15) break;sfx.buy();S.coins-=15;S.meds++;toast('Medicine bought.');changed();renderTab('shop');break;
    case 'buy-theme': {
      const t=THEMES.find(x=>x.id===id);if(!t||S.coins<t.price) break;
      sfx.buy();S.coins-=t.price;S.themes[id]=1;S.theme=id;toast(`${t.n} is now your backdrop.`);changed();renderTab('shop');break;
    }
    case 'use-theme': S.theme=id;changed();renderTab('shop');break;
    case 'backup-copy': backupCopy();break;
    case 'backup-restore-open': sheetState.restore=!sheetState.restore;sheetState.pending=null;sheetState.msg='';renderSheet(true);break;
    case 'backup-restore-go': backupRestoreGo();break;
    case 'dev-tap': {
      clearTimeout(devTimer);devTimer=setTimeout(()=>{devTaps=0;},1800);
      devTaps++;
      if(devTaps>=7&&!devOn){devOn=true;devTaps=0;toast('Developer tools on for this visit.');renderSheet(true);}
      break;
    }
    case 'ff': if(devOn) advance(+el.dataset.m);break;
    case 'reset': {
      if(!sheetState.armed){sheetState.armed=true;renderSheet(true);break;}
      try{localStorage.removeItem(SAVE_KEY);}catch(e){}
      JUICE_ON=false;newGame();JUICE_Q.length=0;JUICE_ON=true;
      breedSel={a:null,b:null};scene.rt.clear();scene.food.length=0;scene.parts.length=0;scene.ripples.length=0;
      scene.vw=scene.va=scene.pileN=null;scene.wipe=scene.swirl=scene.rinse=null;
      S.seenWelcome=true;S.news=NEWS_V;closeSheet();setTab('tank');snapCoins();changed();toast('Fresh tank, fresh start.');break;
    }
  }
}
function advance(mins){
  mins=Math.min(mins,OFFLINE_CAP_MIN);
  const ev=simulate(mins);
  JUICE_Q.length=0;
  lastSimAt=Date.now();
  showAway(mins,ev);
  changed();
}
function showAway(mins,ev){
  sfx.chime();
  openSheet('away',{ev,label:`You were away for ${fmtDur(mins)}.`});
  if(curTab!=='tank') renderTab(curTab);
}

document.addEventListener('click',e=>{
  const sh=$('#sheet');
  if(e.target===sh){closeSheet();return;}
  const el=e.target.closest('[data-act]');
  if(el&&!el.disabled){
    audioResume();
    if(!OWN_SFX.has(el.dataset.act)) sfx.tap();
    onAct(el);
    popEl(el);
  }else{
    const b=e.target.closest('button');
    if(b&&!b.disabled) popEl(b);
  }
});
const OWN_SFX=new Set(['tab','feed','scrub','water','rinse','treat','treat-one','sell','breed-go','buy-fish','buy-decor','buy-tank','buy-filter','buy-feeder','refill','buy-med','buy-theme','collect','dev-tap']);
$('#btnSound').addEventListener('click',()=>{
  audioResume();
  S.sound=!S.sound;
  renderSoundBtn();
  if(S.sound) sfx.chime();
  markDirty();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetState) closeSheet();});
$('#decorBtn').addEventListener('click',()=>toggleDecor(!scene.decorMode));
$('#btnSettings').addEventListener('click',()=>openSheet('settings'));
