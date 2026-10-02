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
function reset(){S=defaultState();S.algae=0;scene.rt.clear();scene.t=100;scene.food=[];scene.bubbles=[];scene.fx=[];scene.shells=[];}
function fish(trait='bold',sp='tetra',x=40,y=45){
  const f=makeFish(sp,founderGenes(SP[sp].kind),200);f.trait=trait;f.hunger=100;delete f.favorite;ensureFavoritePlace(f);S.fish.push(f);
  const r=rtFor(f);Object.assign(r,{x,y,tx:x,ty:y,wait:0});return [f,r];
}
function advance(seconds){for(let t=0;t<seconds;t+=0.05){scene.t+=0.05;updateScene(0.05);}}
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
check('greetings change no economy and do not create non-fish habits',()=>{
  reset();const [f]=fish();const before=JSON.stringify(S);reactToGlass(80,45);advance(24);assert.equal(JSON.stringify(S),before);
  reset();for(const sp of ['cherry','moon','comb']){const [f,r]=fish('bold',sp);assert.equal(f.favorite,undefined);reactToGlass(60,45);assert.equal(r.greeting,undefined);}
});
`,context);
}
