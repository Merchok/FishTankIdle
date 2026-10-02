/* ================= state ================= */
let S=null;
const SAVE_KEY='finlings.save.v1';
const EGG_BY_KIND={fish:30,shrimp:40,jelly:45};
const POLYP_CHILL_MIN=180;
/* celebration events: the sim queues them, the scene draws bursts, the UI shows toasts */
const JUICE_Q=[];let JUICE_ON=false;
function qJuice(e){
  if(!JUICE_ON) return;
  if(JUICE_Q.length>24) JUICE_Q.shift();
  e.t0=performance.now();JUICE_Q.push(e);
}

function defaultState(){
  return {v:2,coins:60,pile:0,coinFrac:0,nextId:1,fish:[],eggs:[],polyps:[],waste:10,filter:100,algae:5,temp:25,heater:25,
    tankLvl:0,filterLvl:0,feeder:{owned:false,stock:0},meds:0,themes:{open:1},sound:true,
    decor:{owned:{},slots:[null,null,null,null,null]},theme:'open',
    book:{sp:{},al:{},morph:{},hyb:{}},lastSeen:Date.now(),savedAt:0,created:Date.now(),seenWelcome:false,news:0,
    stats:{hatched:0,bred:0,earned:0,sold:0,released:0,hybrids:0}};
}
function founderGenes(kind){
  const g={};
  const used=lociOf(kind||'fish');
  for(const k of LOCUS_KEYS){
    const n=LOCI[k].common;
    if(!used.includes(k)||k==='sheen') g[k]=[0,0];
    else g[k]=[ri(0,n-1),ri(0,n-1)];
  }
  return g;
}
function makeFish(sp,g,age,hyb){
  const f={id:S.nextId++,name:pick(NAMES),sp,g,age,trait:pick(TRAITS).id,
    hunger:age>=STAGE_AGE[1]?85:95,health:100,sick:false,cool:0};
  if(hyb) f.hyb=hyb;
  ensureFavoritePlace(f);
  return f;
}
function discoverAlleles(sp,g,id){
  const isNew=!S.book.sp[sp];
  S.book.sp[sp]=1;
  const kind=SP[sp].kind||'fish',found=[];
  for(const k of lociOf(kind)){
    const key=kind+'.'+k;
    const a=S.book.al[key]||(S.book.al[key]={});
    g[k].forEach(i=>{
      if(a[i]) return;
      a[i]=1;
      const L=LD(kind,k),o=L.opts[i];
      if(o.n!=='None') found.push({rare:!!o.r,txt:o.n+' '+L.label.toLowerCase()});
    });
  }
  if(isNew) qJuice({kind:'species',id,msg:'New species: '+SP[sp].n+'!'});
  if(found.length){
    found.sort((x,y)=>y.rare-x.rare);
    const top=found[0];
    qJuice({kind:top.rare?'rare':'gene',id,msg:(top.rare?'Rare gene found: ':'New gene: ')+top.txt+(found.length>1?' (+'+(found.length-1)+' more)':'')+(top.rare?'!':'')});
  }
}
function noteHybrid(sp,hyb){if(hyb){S.book.hyb[hybKey(sp,hyb)]=1;S.stats.hybrids++;}}
function discover(f){
  discoverAlleles(f.sp,f.g,f.id);
  if(f.hyb){
    const k=hybKey(f.sp,f.hyb);
    if(!S.book.hyb[k]){S.book.hyb[k]=1;qJuice({kind:'hyb',id:f.id,msg:'New hybrid: '+hybLabel(f)+'!'});}
  }
  S.book.morph[morphKey(f)]=1;
}
function addFish(f){S.fish.push(f);discover(f);return f;}
function newGame(){
  S=defaultState();
  addFish(makeFish('tetra',founderGenes('fish'),STAGE_AGE[1]+30));
  addFish(makeFish('tetra',founderGenes('fish'),STAGE_AGE[1]+30));
}
function normalize(o){
  const d=defaultState();
  const s=Object.assign(d,o);
  s.v=2;
  s.feeder=Object.assign(d.feeder,o.feeder||{});
  s.decor={owned:Object.assign({},(o.decor&&o.decor.owned)||{}),slots:((o.decor&&o.decor.slots)||d.decor.slots).slice(0,5)};
  while(s.decor.slots.length<5) s.decor.slots.push(null);
  const al={};
  const oldAl=(o.book&&o.book.al)||{};
  for(const k of Object.keys(oldAl)) al[k.indexOf('.')<0?'fish.'+k:k]=oldAl[k];
  const fixId=id=>id==='lantern'?'nettle':id;
  const bsp={};for(const k of Object.keys((o.book&&o.book.sp)||{})) bsp[fixId(k)]=1;
  const bm={};for(const k of Object.keys((o.book&&o.book.morph)||{})) bm[k.replace(/^lantern\./,'nettle.').replace(/\+lantern$/,'+nettle')]=1;
  s.book={sp:bsp,al,morph:bm,hyb:Object.assign({},(o.book&&o.book.hyb)||{})};
  s.stats=Object.assign(d.stats,o.stats||{});
  s.themes=Object.assign({open:1},o.themes||{});
  for(const f of (o.fish||[]).concat(o.polyps||[])){if(f){f.sp=fixId(f.sp);if(f.hyb) f.hyb=fixId(f.hyb);}}
  s.fish=(o.fish||[]).filter(f=>f&&SP[f.sp]&&f.g&&(!f.hyb||SP[f.hyb]));
  for(const f of s.fish){if(!f.trait||!TRAIT[f.trait]) f.trait=pick(TRAITS).id;ensureFavoritePlace(f,s);}
  s.polyps=(o.polyps||[]).filter(p=>p&&SP[p.sp]&&p.g&&(!p.hyb||SP[p.hyb]));
  s.eggs=(o.eggs||[]).map(e=>{
    e.sp=fixId(e.sp);
    e.kids=(e.kids||[]).map(k=>{if(k&&k.g&&k.sp){k.sp=fixId(k.sp);if(k.hyb) k.hyb=fixId(k.hyb);return k;}return {g:k,sp:e.sp};});
    return e;
  }).filter(e=>SP[e.sp]);
  s.pile=+s.pile||0;
  if(s.pile===0&&s.coinFrac){s.pile=s.coinFrac;s.coinFrac=0;}
  return s;
}
/* A small, saved habit, not a need: fish remember a place without rewards or decay.
   Coordinates use the tank's fixed 160 × 120 space, so resizing does not move it. */
function ensureFavoritePlace(f,state=S){
  if(kindOf(f)!=='fish') return null;
  const slots=state.decor.slots,seed=hash2(f.id,37);
  const placed=slots.map((id,slot)=>({id,slot})).filter(p=>DECOR[p.id]);
  let home=f.favorite;
  const valid=home&&Number.isInteger(home.slot)&&home.slot>=0&&home.slot<5&&
    Number.isFinite(home.x)&&home.x>=10&&home.x<=150&&Number.isFinite(home.y)&&home.y>=14&&home.y<=96&&
    (home.decor===null||Object.prototype.hasOwnProperty.call(DECOR,home.decor));
  if(!valid) home=null;
  // Keep the original attachment while an item is put away and placed again.
  const preferred=home&&(Object.prototype.hasOwnProperty.call(DECOR,home.preferred)?home.preferred:home.decor);
  if(preferred&&slots.includes(preferred)&&home.decor!==preferred){
    home=Object.assign({},home,{decor:preferred,slot:slots.indexOf(preferred)});
  }
  if(home&&home.decor){
    if(slots[home.slot]!==home.decor){
      const matches=placed.filter(p=>p.id===home.decor).sort((a,b)=>Math.abs(a.slot-home.slot)-Math.abs(b.slot-home.slot));
      home=matches.length?Object.assign({},home,{slot:matches[0].slot}):null;
    }
  }
  if(!home||(!home.decor&&placed.length)){
    const sheltered=placed.filter(p=>DECOR[p.id].plant);
    const choices=f.trait==='shy'&&sheltered.length?sheltered:placed;
    const p=choices.length?choices[seed%choices.length]:null;
    home={decor:p?p.id:null,slot:p?p.slot:seed%5,
      x:18+seed%125,y:clamp(24+SP[f.sp].dep*65+(seed%13-6),14,96)};
  }
  if(home.decor){
    home.x=clamp(SLOT_X[home.slot]+(seed%13-6),10,150);
    home.y=DECOR[home.decor].plant?78+seed%12:84+seed%11;
  }
  home.preferred=preferred||home.decor;
  f.favorite=home;
  return home;
}
function favoritePlaceLabel(f){
  const h=ensureFavoritePlace(f);
  if(!h) return '';
  const side=h.x<58?'left':h.x>102?'right':'middle';
  return h.decor?'Near the '+DECOR[h.decor].n.toLowerCase()+' ('+side+')':
    'A quiet spot '+(side==='middle'?'in the middle':'on the '+side);
}
function serialize(){S.savedAt=Date.now();S.lastSeen=Date.now();return JSON.stringify(S);}

/* ================= derived values ================= */
const stageOf=f=>f.age<STAGE_AGE[0]?0:(f.age<STAGE_AGE[1]?1:2);
const stageName=f=>STAGE_NAMES[kindOf(f)][stageOf(f)];
const capacity=()=>TANKS[S.tankLvl].cap;
const weightOf=f=>SP[f.sp].w||1;
const usedSpace=()=>S.fish.reduce((a,f)=>a+weightOf(f),0);
const hasRoom=spId=>usedSpace()+(SP[spId].w||1)<=capacity()+0.001;
const fmtSpace=n=>(Math.round(n*10)/10).toString();
const polypCap=()=>2+S.tankLvl;
function fishValue(f){return Math.round(baseValue(f)*(1+0.6*rarity(phenotype(f))));}
function sellPrice(f){return Math.max(1,Math.round(fishValue(f)*[0.3,0.45,0.6][stageOf(f)]));}
function incomePerHour(f){
  if(f.sick||stageOf(f)<1||f.hunger<=25) return 0;
  return fishValue(f)*0.1*(stageOf(f)===2?1:0.5);
}
function tempOff(f){const sp=rangeOf(f);return S.temp<sp.lo?sp.lo-S.temp:(S.temp>sp.hi?S.temp-sp.hi:0);}
const wasteLimit=f=>SP[f.sp].sens?40:55;
function mood(f){
  if(f.sick) return ['Sick','bad'];
  if(f.hunger<25) return ['Starving','bad'];
  if(f.hunger<45) return ['Hungry','warn'];
  if(S.waste>wasteLimit(f)+5) return ['Stressed','warn'];
  if(tempOff(f)>0.5) return ['Chilly or hot','warn'];
  if(f.health>75&&f.hunger>60&&S.waste<wasteLimit(f)-15) return ['Happy','good'];
  return ['Content','ok'];
}
const plantCount=()=>S.decor.slots.filter(id=>id&&DECOR[id].plant).length;
const sickCount=()=>S.fish.filter(f=>f.sick).length;
const isBerried=f=>S.eggs.some(e=>e.carrier===f.id);
function cloneGenes(g){const o={};for(const k of LOCUS_KEYS) o[k]=g[k].slice();return o;}

/* ================= simulation ================= */
function newFry(sp,g,hyb){
  const f=makeFish(sp,g,0,hyb);
  f.hunger=80;
  return f;
}
function newPolyp(sp,g,hyb){
  const p={id:S.nextId++,sp,g,size:1,chill:0,born:Date.now()};
  if(hyb) p.hyb=hyb;
  return p;
}
function step(dt,ev){
  const T=TANKS[S.tankLvl],F=FILTERS[S.filterLvl];
  S.temp+=clamp(S.heater-S.temp,-dt*0.1,dt*0.1);
  S.filter=Math.max(0,S.filter-dt*100/(F.life*60));
  let load=0,eaters=0;
  for(const f of S.fish){
    const st=stageOf(f);
    load+=[0.35,0.7,1][st]*(SP[f.sp].w||1);
    if(SP[f.sp].algae&&st>=1) eaters+=SP[f.sp].algae;
  }
  const fm=Math.max(0.1,1.25-S.filter/100*F.eff);
  const wm=T.dil*(1-0.03*plantCount());
  S.waste=clamp(S.waste+load*0.02*fm*wm*dt,0,100);
  S.algae=clamp(S.algae+(0.012+S.waste*0.0005)*dt-eaters*0.03*dt,0,100);

  const rev=[];
  for(const f of S.fish){
    const before=stageOf(f);
    f.age+=dt;
    const st=stageOf(f),sp=SP[f.sp];
    if(st>before){ev.grown=(ev.grown||0)+1;if(typeof onStageUp==='function') onStageUp(f,st);}
    const tm=f.trait==='greedy'?1.1:(f.trait==='lazy'?0.92:1);
    f.hunger=Math.max(0,f.hunger-100/600*sp.hun*tm*[1.3,1.1,1][st]*dt);
    if(S.feeder.owned&&S.feeder.stock>0&&f.hunger<35){
      f.hunger=Math.min(100,f.hunger+60);S.feeder.stock--;S.waste=Math.min(100,S.waste+0.6);ev.fed++;
    }
    let dmg=0;
    if(f.hunger<25) dmg+=(25-f.hunger)/25*0.16;
    const wl=wasteLimit(f);
    if(S.waste>wl) dmg+=(S.waste-wl)/(100-wl)*0.18;
    if(S.algae>85) dmg+=0.03;
    const off=tempOff(f);
    if(off>0.5) dmg+=Math.min(off,6)*0.05;
    if(dmg>0) f.health-=dmg*dt;
    else if(f.hunger>40&&S.waste<wl-10) f.health+=0.1*dt;
    f.health=clamp(f.health,5,100);
    if(!f.sick&&f.health<35){
      if(sp.immortal&&st>=1&&S.polyps.length+rev.length<polypCap()) rev.push(f);
      else{f.sick=true;ev.sick++;}
    }else if(f.sick&&f.health>=60) f.sick=false;
    f.cool=Math.max(0,f.cool-dt);
    S.pile+=incomePerHour(f)/60*dt;
  }

  for(const f of rev){
    S.fish=S.fish.filter(x=>x!==f);
    const p=newPolyp(f.sp,cloneGenes(f.g),f.hyb);p.size=2;p.was=f.name;
    S.polyps.push(p);ev.reverted.push(f.name);
  }

  /* eggs and larvae */
  for(const egg of S.eggs){
    egg.t=Math.max(0,egg.t-dt);
    if(egg.t>0) continue;
    const keep=[];
    for(const kid of egg.kids){
      if(viaPolyp(kid.sp)){
        if(S.polyps.length<polypCap()){
          S.polyps.push(newPolyp(kid.sp,kid.g,kid.hyb));discoverAlleles(kid.sp,kid.g);noteHybrid(kid.sp,kid.hyb);ev.settled=(ev.settled||0)+1;
        }else keep.push(kid);
      }else if(hasRoom(kid.sp)){
        const nf=addFish(newFry(kid.sp,kid.g,kid.hyb));qJuice({kind:'hatch',id:nf.id});noteHybrid(kid.sp,kid.hyb);S.stats.hatched++;ev.hatched++;
      }else keep.push(kid);
    }
    egg.kids=keep;
  }
  S.eggs=S.eggs.filter(e=>e.kids.length>0);

  /* jellyfish polyps: slow growth, cold wakes them up */
  for(const p of S.polyps){
    const cold=coldOf(p);
    if(S.waste<60) p.size=Math.min(8,p.size+dt/150);
    if(S.temp<=cold+0.2) p.chill+=dt; else p.chill=Math.max(0,p.chill-dt*0.5);
    if(p.chill>=POLYP_CHILL_MIN&&p.size>=2){
      const want=clamp(Math.floor(p.size/2),1,4);
      let made=0;
      while(made<want&&hasRoom(p.sp)){
        const nf=addFish(newFry(p.sp,cloneGenes(p.g),p.hyb));
        if(p.was){nf.name=p.was;delete p.was;}
        qJuice({kind:'hatch',id:nf.id});
        made++;
      }
      if(made){
        p.size=Math.max(1,p.size-made*1.5);p.chill=0;
        ev.released=(ev.released||0)+made;S.stats.released++;
      }
    }
  }
}
function simulate(mins){
  const ev={coins:0,hatched:0,sick:0,fed:0,grown:0,settled:0,released:0,reverted:[]};
  const pile0=S.pile;
  let left=mins;
  while(left>0.0001){const dt=Math.min(10,left);left-=dt;step(dt,ev);}
  ev.coins=Math.max(0,S.pile-pile0);
  return ev;
}

/* ================= breeding ================= */
function inherit(key,pair){
  let a=pair[Math.random()<0.5?0:1];
  if(Math.random()<MUT) a=mutateAllele(key,a);
  return a;
}
function mutateAllele(key,cur){
  const o=LOCI[key].opts,rare=[],common=[];
  for(let i=0;i<o.length;i++){if(i===cur) continue;(o[i].r?rare:common).push(i);}
  const pool=(rare.length&&Math.random()<0.55)?rare:(common.length?common:rare);
  return pick(pool);
}
function crossGenes(a,b){
  const g={};
  const used=lociOf(kindOf(a));
  for(const k of LOCUS_KEYS) g[k]=used.includes(k)?[inherit(k,a.g[k]),inherit(k,b.g[k])]:[0,0];
  return g;
}
function breedBlock(f){
  if(f.hyb) return 'Hybrids are sterile';
  if(stageOf(f)<2) return 'Still growing';
  if(f.sick) return 'Sick';
  if(f.hunger<30) return 'Too hungry';
  if(f.cool>0) return 'Resting '+fmtDur(f.cool);
  return '';
}
function pairBlock(a,b){
  if(!a||!b) return 'Choose two';
  if(kindOf(a)!==kindOf(b)) return 'Same kind only';
  if(S.eggs.length>=NURSERY_MAX) return 'The nursery is full';
  return breedBlock(a)||breedBlock(b)||'';
}
function doBreed(a,b){
  const kind=kindOf(a),mixed=a.sp!==b.sp;
  const bothDirect=!!SP[a.sp].direct&&!!SP[b.sp].direct;
  const n=kind==='jelly'?(bothDirect?ri(2,3):ri(1,2)):(kind==='shrimp'?ri(3,6):ri(2,4));
  const kids=[];
  for(let i=0;i<n;i++){
    const kid={g:crossGenes(a,b),sp:a.sp};
    if(mixed){kid.sp=Math.random()<0.5?a.sp:b.sp;kid.hyb=kid.sp===a.sp?b.sp:a.sp;}
    kids.push(kid);
  }
  const total=bothDirect?35:EGG_BY_KIND[kind];
  const egg={id:S.nextId++,sp:a.sp,t:total,total,kids,parents:[a.name,b.name]};
  if(kind==='shrimp') egg.carrier=(Math.random()<0.5?a:b).id;
  S.eggs.push(egg);
  a.cool=b.cool=COOLDOWN_MIN;
  S.stats.bred++;
  return {n,kind,total,mixed,direct:bothDirect,poly:kids.some(k=>viaPolyp(k.sp))};
}
/* chance table for one locus given two parents (ignores mutation) */
function predictLocus(key,a,b){
  const kind=kindOf(a),L=LD(kind,key);
  const map=new Map();
  for(const x of a.g[key]) for(const y of b.g[key]){
    let label,sw=null,rare=false;
    if(key==='size'){label=SIZE_NAMES[(x+y)];}
    else if(key==='sheen'){const v=(x===y&&x>0)?x:0;label=L.opts[v].n;rare=v>0;}
    else{const v=expr(key,[x,y]);label=L.opts[v].n;if(key==='color'||key==='accent') sw=COLORS[v].c;rare=!!L.opts[v].r;}
    const m=map.get(label)||{label,sw,rare,p:0};
    m.p+=0.25;map.set(label,m);
  }
  return [...map.values()].sort((p,q)=>q.p-p.p);
}

/* ================= actions ================= */
function sellFish(f){
  const p=sellPrice(f);
  S.coins+=p;S.stats.sold++;
  S.fish=S.fish.filter(x=>x!==f);
  S.eggs.forEach(e=>{if(e.carrier===f.id) e.carrier=null;});
  return p;
}
function collectPile(){
  const n=Math.floor(S.pile);
  if(n<1) return 0;
  S.pile-=n;S.coins+=n;S.stats.earned+=n;
  return n;
}
function needsAttention(){
  if(!S) return false;
  return S.fish.some(f=>f.hunger<35||f.sick)||S.waste>55||S.algae>75||S.filter<15||S.pile>=1;
}
function dayLight(){
  const d=new Date(),h=d.getHours()+d.getMinutes()/60;
  const up=clamp((h-5.5)/2.5,0,1),down=clamp((20.5-h)/2.5,0,1);
  return Math.min(up,down);
}
