/* Source-level regression checks. No DOM/browser is needed; rendering is stubbed.
   Run: node tests/fish_personality_unit.js */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
for(const reduced of [false,true]){
console.log('Motion mode: '+(reduced?'reduced':'normal'));
const context=vm.createContext({console,assert,performance:{now:()=>0},window:{matchMedia:()=>({matches:reduced})},matchMedia:()=>({matches:reduced})});
for(const file of ['21-data.js','22-sim.js','23-scene.js','23b-juice.js']) vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{filename:file});
vm.runInContext(`
let curTab='tank',sheetState=null;
const sfx={eat(){},bubble(){},tink(){}};
getSprite=()=>({w:20,h:10,feet:8});updateJuice=()=>{};dayLight=()=>1;
let randomSeed=1;
Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
function reset(){
  randomSeed=12345;S=defaultState();S.algae=0;scene.rt.clear();scene.t=100;scene.decorMode=false;
  for(const key of ['food','bubbles','fx','shells','parts','ripples'])scene[key]=[];
  dayLight=()=>1;
}
function fish(trait='bold',sp='tetra',x=40,y=45){
  const f=makeFish(sp,founderGenes(SP[sp].kind),200);f.trait=trait;f.hunger=100;delete f.favorite;ensureFavoritePlace(f);S.fish.push(f);
  const r=rtFor(f);Object.assign(r,{x,y,tx:x,ty:y,wait:0});return [f,r];
}
function advance(seconds){
  for(let remaining=seconds;remaining>1e-8;){const dt=Math.min(0.05,remaining);scene.t+=dt;updateScene(dt);remaining-=dt;}
}
function creature(trait,sp,x=55){
  const [f,r]=fish(trait,sp,x,45),s=getSprite(f,stageOf(f),f.sick);
  if(kindOf(f)==='shrimp')r.y=floorY(f,s);
  else if(kindOf(f)==='jelly')r.y=SP[f.sp].floor?SAND_Y+4-s.h/2:jellyDepthY(f,s);
  r.ty=r.y;return [f,r,s];
}
const shrimpSpecies=SPECIES.filter(sp=>sp.kind==='shrimp').map(sp=>sp.id);
const jellySpecies=SPECIES.filter(sp=>sp.kind==='jelly').map(sp=>sp.id);
function check(name,fn){fn();console.log('PASS '+name);}
check('favorite survives normalize, relocation, remove/re-place, and backup',()=>{
  reset();S.decor.slots=['rock',null,'kelp',null,null];const [f]=fish('shy');assert.equal(f.favorite.decor,'kelp');
  const initial=JSON.stringify(f.favorite);S=normalize(JSON.parse(serialize()));assert.equal(JSON.stringify(S.fish[0].favorite),initial);
  S.decor.slots[2]=null;ensureFavoritePlace(S.fish[0]);assert.equal(S.fish[0].favorite.decor,'rock');assert.equal(S.fish[0].favorite.preferred,'kelp');
  S=normalize(JSON.parse(serialize()));S.decor.slots[4]='kelp';ensureFavoritePlace(S.fish[0]);assert.equal(S.fish[0].favorite.slot,4);assert.equal(S.fish[0].favorite.decor,'kelp');
});
check('legacy and malformed favorites repair deterministically',()=>{
  reset();const [f]=fish();const good=JSON.stringify(f.favorite);delete f.favorite;ensureFavoritePlace(f);assert.equal(JSON.stringify(f.favorite),good);
  f.favorite={decor:'bad',slot:99,x:NaN,y:-1};S=normalize(JSON.parse(serialize()));assert.equal(JSON.stringify(S.fish[0].favorite),good);
  S.decor.slots[1]='fern';ensureFavoritePlace(S.fish[0]);assert.equal(S.fish[0].favorite.decor,'fern');
});
check('favorite rest is a real movement target',()=>{
  reset();S.decor.slots[0]='fern';const [f,r]=fish('lazy');pickFishTarget(f,r,SP[f.sp],2,1);
  assert.equal(r.visitingHome,true);assert.ok(Math.hypot(r.tx-f.favorite.x,r.ty-f.favorite.y)<4);
  r.x=r.tx;r.y=r.ty;moveFish(f,r,SP[f.sp],2,1,0.05,5,false);assert.equal(r.atHome,true);assert.ok(r.wait>=3);
});
check('bold approaches and shy retreats then returns',()=>{
  reset();let [f,r]=fish('bold');reactToGlass(75,45);const d=Math.abs(r.x-75);advance(1);assert.ok(Math.abs(r.x-75)<d);
  reset();[f,r]=fish('shy');reactToGlass(65,45);const start=r.x;advance(1);assert.ok(r.x<start);advance(1);assert.equal(r.greeting.phase,'approach');const away=r.x;advance(3);assert.ok(r.x>away);advance(23);assert.equal(r.greeting,null);
});
check('slow social fish reaches and lingers',()=>{
  reset();const [f,r]=fish('social','pleco',20,60);reactToGlass(100,60);let linger=false;
  for(let i=0;i<400;i++){advance(0.05);if(r.greeting?.phase==='linger') linger=true;}
  assert.ok(linger);advance(5);assert.equal(r.greeting,null);
});
check('repeated taps cannot restart greetings or exceed three',()=>{
  reset();for(let i=0;i<6;i++)fish('bold','tetra',40+i*3,45);reactToGlass(80,45);
  const first=scene.rt.get(S.fish[0].id).greeting;for(let i=0;i<20;i++)reactToGlass(80,45);
  assert.equal(S.fish.filter(f=>scene.rt.get(f.id).greeting).length,3);assert.equal(scene.rt.get(S.fish[0].id).greeting,first);
});
check('food, sleep, sickness and fleeing interrupt safely',()=>{
  reset();let [f,r]=fish();reactToGlass(80,45);f.hunger=50;scene.food=[{x:120,y:20,vy:0,t:10,floor:false}];advance(.1);assert.equal(r.greeting,null);assert.equal(r.tx,120);
  reset();[f,r]=fish();reactToGlass(80,45);dayLight=()=>0;advance(.1);assert.equal(r.greeting,null);dayLight=()=>1;
  reset();[f,r]=fish();reactToGlass(80,45);f.sick=true;advance(.1);assert.equal(r.greeting,null);
  reset();[f,r]=fish();reactToGlass(80,45);r.flee=1;r.tx=140;r.ty=80;advance(.1);assert.equal(r.greeting,null);assert.equal(r.tx,140);assert.equal(r.ty,80);reactToGlass(80,45);assert.equal(r.greeting,null);
});
check('slow dusk fish reaches and lingers at its actual pace',()=>{
  reset();const [f,r]=fish('social','pleco',20,45);dayLight=()=>0.41;reactToGlass(105,45);let linger=false;
  for(let i=0;i<800;i++){advance(0.05);if(r.greeting?.phase==='linger'){linger=true;break;}}
  assert.ok(linger);assert.ok(Math.hypot(r.x-r.greeting.x,r.y-r.greeting.y)<3);
  advance(3);assert.equal(r.greeting,null);dayLight=()=>1;
});
check('greeting heart is visible on arrival only with normal motion',()=>{
  reset();const [f,r]=fish();reactToGlass(60,45);let arrived=false;
  for(let i=0;i<200;i++){
    advance(0.05);
    if(REDUCED) assert.equal(scene.fx.filter(e=>e.type==='heart').length,0);
    if(r.greeting?.phase==='linger'){
      arrived=true;
      assert.equal(scene.fx.some(e=>e.type==='heart'),!REDUCED);
      break;
    }
  }
  assert.ok(arrived,'inspect the arrival frame before the heart expires');
});
check('shrimp remember rock/plant favorites across relocation, removal and saves',()=>{
  for(const sp of shrimpSpecies){
    reset();S.decor.slots=['castle','rock',null,'kelp',null];const [f]=creature('shy',sp);
    assert.ok(f.favorite.decor==='rock'||DECOR[f.favorite.decor].plant);
    const before=JSON.stringify(f.favorite),preferred=f.favorite.decor,slot=f.favorite.slot;
    S=normalize(JSON.parse(serialize()));assert.equal(JSON.stringify(S.fish[0].favorite),before);
    const saved=S.fish[0];S.decor.slots[slot]=null;S.decor.slots[4]=preferred;ensureFavoritePlace(saved);
    assert.equal(saved.favorite.slot,4);assert.equal(saved.favorite.decor,preferred);
    S.decor.slots[4]=null;ensureFavoritePlace(saved);assert.equal(saved.favorite.preferred,preferred);
    S=normalize(JSON.parse(serialize()));S.decor.slots[0]=preferred;ensureFavoritePlace(S.fish[0]);
    assert.equal(S.fish[0].favorite.decor,preferred);assert.equal(S.fish[0].favorite.slot,0);
  }
});
check('legacy and malformed shrimp favorites repair deterministically',()=>{
  for(const sp of shrimpSpecies){
    reset();const [f]=creature('bold',sp);const good=JSON.stringify(f.favorite);
    for(const bad of [undefined,null,'broken',{}, {decor:'bad',slot:99,x:NaN,y:-1}]){
      f.favorite=bad;ensureFavoritePlace(f);assert.equal(JSON.stringify(f.favorite),good);
    }
    S.decor.slots[2]='rock';ensureFavoritePlace(f);assert.equal(f.favorite.decor,'rock');
    S.decor.slots[2]=null;ensureFavoritePlace(f);assert.ok(Number.isFinite(f.favorite.x));
  }
});
check('shrimp ordinary movement visits their saved shelter',()=>{
  reset();S.decor.slots[1]='rock';const [f,r,s]=creature('lazy','cherry',120),random=Math.random;
  try{Math.random=()=>0;r.tx=r.x;r.wait=0;moveShrimp(f,r,SP[f.sp],2,1,.05,5,false,s);}
  finally{Math.random=random;}
  assert.ok(Math.abs(r.tx-f.favorite.x)<6);assert.equal(r.y,floorY(f,s));
});
check('shrimp forage only while resting, awake and healthy without changing state',()=>{
  reset();const [f,r,s]=creature('bold','cherry');r.wait=10;const before=JSON.stringify(S);
  advance(.05);assert.equal(r.foraging,true);assert.equal(r.y,floorY(f,s));assert.equal(JSON.stringify(S),before);
  reactToGlass(85,99);advance(.05);assert.equal(r.foraging,false);
  r.greeting=null;r.wait=10;f.sick=true;advance(.05);assert.equal(r.foraging,false);
  f.sick=false;r.wait=10;dayLight=()=>0;advance(.05);assert.equal(r.foraging,false);
  dayLight=()=>1;r.sleep=false;r.hop=.5;r.hopV=-5;r.greetAfter=0;
  reactToGlass(85,99);assert.ok(!r.greeting,'glass taps do not interrupt existing hops');
  advance(.05);assert.equal(r.foraging,false);
});
check('every shrimp trait freezes, stays grounded, then returns gently',()=>{
  for(const sp of shrimpSpecies)for(const {id:trait} of TRAITS){
    reset();const [f,r,s]=creature(trait,sp),origin=r.x,fy=floorY(f,s);
    reactToGlass(85,99);assert.equal(r.greeting?.phase,'freeze',sp+' '+trait);
    advance(.1);assert.equal(r.x,origin);assert.equal(r.y,fy);
    let retreat=false,returned=false,returnStart=null,returnClosest=Infinity,maxStep=0;
    for(let i=0;i<600&&r.greeting;i++){
      const x=r.x;advance(.05);maxStep=Math.max(maxStep,Math.abs(r.x-x));
      assert.equal(r.y,fy);assert.equal(r.hop,0);assert.ok(Number.isFinite(r.x)&&r.x>=6&&r.x<=154);
      assert.ok(!['approach','linger','watch','drift'].includes(r.greeting?.phase));
      if(r.greeting?.phase==='retreat'){retreat=true;assert.ok(r.x<=origin);}
      if(r.greeting?.phase==='return'){
        returned=true;const d=Math.abs(r.x-origin);if(returnStart===null)returnStart=d;returnClosest=Math.min(returnClosest,d);
      }
    }
    assert.ok(!r.greeting,'shrimp reaction must finish');assert.ok(maxStep<1,'shrimp reaction stays gentle');
    if(trait==='lazy')assert.equal(r.x,origin);
    else{assert.ok(retreat&&returned,sp+' '+trait+' retreat/return');assert.ok(returnClosest<returnStart);assert.ok(Math.abs(r.x-origin)<3);}
    assert.equal(scene.fx.some(e=>e.type==='heart'),false);
  }
});
check('all jelly species save a deterministic preferred depth with safe migration',()=>{
  for(const sp of jellySpecies){
    reset();const [f,,s]=creature('bold',sp),good=f.preferredDepth;
    assert.ok(Number.isFinite(good));assert.ok(SP[sp].floor?good===.98:good>=.15&&good<=.8);
    assert.equal(f.favorite,undefined);assert.ok(Number.isFinite(jellyDepthY(f,s)));
    for(const bad of [undefined,null,'broken',{},NaN,Infinity,-100,100]){
      f.preferredDepth=bad;ensurePreferredDepth(f);assert.equal(f.preferredDepth,good);
    }
    if(!SP[sp].floor){f.preferredDepth=.61;ensurePreferredDepth(f);assert.equal(f.preferredDepth,.61);}
    const before=f.preferredDepth;S=normalize(JSON.parse(serialize()));assert.equal(S.fish[0].preferredDepth,before);
    delete S.fish[0].preferredDepth;const raw=JSON.parse(serialize());
    const a=normalize(JSON.parse(JSON.stringify(raw))).fish[0].preferredDepth;
    const b=normalize(JSON.parse(JSON.stringify(raw))).fish[0].preferredDepth;
    assert.equal(a,b);assert.equal(a,good);
  }
});
check('jelly wandering uses the preferred depth rather than fish favorite places',()=>{
  for(const sp of jellySpecies.filter(id=>!SP[id].floor)){
    reset();const [f,r,s]=creature('bold',sp),random=Math.random;f.preferredDepth=.62;
    try{Math.random=()=>.5;pickJellyTarget(f,r,s);}finally{Math.random=random;}
    assert.ok(Math.abs(r.ty-jellyDepthY(f,s))<10,sp+' preferred band');assert.equal(r.visitingHome,false);
    assert.equal(f.favorite,undefined);
  }
});
check('every jelly trait responds with a brief course change, never a fish greeting',()=>{
  for(const sp of jellySpecies)for(const {id:trait} of TRAITS){
    reset();const [f,r,s]=creature(trait,sp),origin=r.x,depth=f.preferredDepth;
    reactToGlass(85,Math.min(r.y,99));assert.equal(r.greeting?.phase,'drift',sp+' '+trait);
    assert.ok(Math.abs(r.greeting.courseX-origin)<=12);let maxStep=0,moved=false,pulsed=false;
    for(let i=0;i<200&&r.greeting;i++){
      const {x,y,pp}=r;advance(.05);const distance=Math.hypot(r.x-x,r.y-y);maxStep=Math.max(maxStep,distance);moved=moved||distance>0;pulsed=pulsed||r.pp!==pp;
      assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y));assert.ok(r.x>=6&&r.x<=154);
      if(SP[sp].floor)assert.equal(r.y,SAND_Y+4-s.h/2);
      else assert.ok(r.y>=8&&r.y<=SAND_Y-s.h/2-4);
      if(r.greeting)assert.equal(r.greeting.phase,'drift');
    }
    assert.ok(!r.greeting);assert.ok(pulsed,'native jelly pulse continues');if(trait!=='lazy')assert.ok(moved);assert.ok(maxStep<=Math.hypot(SP[sp].spd*16*traitSpeed(trait)*1.4*.05,.6)+1e-8,sp+' '+trait+' response exceeds native pace');
    assert.equal(f.preferredDepth,depth);assert.equal(scene.fx.some(e=>e.type==='heart'),false);
  }
});
check('native jellies resume wandering after a near-target pause',()=>{
  for(const sp of jellySpecies.filter(id=>!SP[id].floor&&!SP[id].glide)){
    reset();const [f,r,s]=creature('bold',sp);r.tx=r.x;r.wait=.1;const initial=r.tx;
    moveJelly(f,r,SP[sp],2,0,.05,5,false,s);assert.equal(r.tx,initial);
    moveJelly(f,r,SP[sp],2,0,.06,5,false,s);assert.notEqual(r.tx,initial);
    assert.ok(Math.abs(r.ty-jellyDepthY(f,s))<=6);assert.ok(r.wait<=0);
  }
});
check('comb responses keep a glide without chase, flee or floor anchoring',()=>{
  reset();const [f,r,s]=creature('playful','comb');r.wait=0;
  reactToGlass(85,r.y);advance(.1);assert.equal(r.greeting.phase,'drift');assert.equal(r.chase,0);assert.equal(r.flee,0);
  assert.ok(r.y<SAND_Y-s.h/2-4);assert.equal(f.favorite,undefined);
});
check('jelly tap pulse stays subtle and is absent under reduced motion',()=>{
  for(const sp of ['moon','mat','comb']){
    const sample=react=>{reset();const [f,r]=creature('bold',sp);r.pp=.2;if(react)reactToGlass(85,Math.min(r.y,99));advance(.1);return r.pp-.2;};
    const ordinary=sample(false),reaction=sample(true);
    assert.ok(reaction>=ordinary-1e-8&&reaction<=ordinary*1.5+1e-8);
    if(REDUCED)assert.ok(Math.abs(reaction-ordinary)<1e-8);else assert.ok(reaction>ordinary);
  }
});
check('the shared three-creature cap and cooldown include shrimp and jellies',()=>{
  reset();creature('bold','tetra');creature('bold','cherry');creature('bold','moon');creature('bold','ghost');creature('bold','comb');
  reactToGlass(75,80);const active=S.fish.filter(f=>rtFor(f).greeting);assert.equal(active.length,3);
  const before=active.map(f=>rtFor(f).greeting);for(let i=0;i<50;i++)reactToGlass(75,80);
  assert.equal(S.fish.filter(f=>rtFor(f).greeting).length,3);assert.ok(active.every((f,i)=>rtFor(f).greeting===before[i]));
  for(const sp of ['cherry','moon','mat','comb']){
    reset();const [f,r]=creature('bold',sp);reactToGlass(85,Math.min(r.y,99));
    while(r.greeting&&scene.t<111.5)advance(.05);assert.ok(!r.greeting);reactToGlass(85,Math.min(r.y,99));assert.ok(!r.greeting);
    advance(13);Object.assign(r,{x:55,hop:0});reactToGlass(85,Math.min(r.y,99));assert.ok(r.greeting);
  }
});
check('food, sleep, sickness and fleeing outrank non-fish reactions',()=>{
  for(const sp of ['cherry','moon','mat','comb'])for(const priority of ['food','sleep','sick','flee']){
    reset();const [f,r]=creature('bold',sp);reactToGlass(85,Math.min(r.y,99));assert.ok(r.greeting);
    if(priority==='food'){f.hunger=50;scene.food=[{x:120,y:kindOf(f)==='shrimp'?103:50,vy:0,t:10,floor:true}];}
    if(priority==='sleep')dayLight=()=>0;
    if(priority==='sick')f.sick=true;
    if(priority==='flee'){r.flee=1;r.tx=140;r.ty=70;}
    advance(.05);assert.ok(!r.greeting,sp+' '+priority+' must interrupt');
    if(priority==='food'&&kindOf(f)==='shrimp')assert.equal(r.tx,120);
    if(priority==='flee'){assert.equal(r.tx,140);assert.equal(r.ty,70);}
    reactToGlass(85,Math.min(r.y,99));assert.ok(!r.greeting);
  }
});
check('polyps remain stationary and acquire no swimmer runtime or habits',()=>{
  reset();const p=newPolyp('moon',founderGenes('jelly'));S.polyps.push(p);const before=JSON.stringify(p);
  for(let i=0;i<20;i++){reactToGlass(30,99);advance(.5);}
  assert.equal(scene.rt.size,0);assert.equal(JSON.stringify(p),before);
  S=normalize(JSON.parse(serialize()));assert.equal(JSON.stringify(S.polyps[0]),before);
  assert.equal(S.polyps[0].favorite,undefined);assert.equal(S.polyps[0].preferredDepth,undefined);
});
check('greetings add no economy, health, hunger, genetics, progression or saved runtime',()=>{
  for(const sp of ['tetra',...shrimpSpecies,...jellySpecies])for(const {id:trait} of TRAITS){
    reset();const [f,r]=creature(trait,sp);const before=JSON.stringify(S);
    reactToGlass(85,Math.min(r.y,99));advance(24);assert.equal(JSON.stringify(S),before,sp+' '+trait);
    assert.equal(f.greeting,undefined);assert.equal(f.greetAfter,undefined);assert.equal(f.foraging,undefined);
    assert.equal(f.trait,trait);
  }
});
`,context);
}
