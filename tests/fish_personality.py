"""Behavioral regression tests for fish, shrimp, and jellyfish little habits.

    bash build.sh
    python tests/fish_personality.py

Uses phone-sized touch browsers plus a desktop screenshot. Scene time advances
deterministically while the economy timer is paused, so assertions do not depend
on wall-clock timing, the time of day, or random swimming. Set
PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a specific browser; a system Chromium is
used when Playwright's download is absent.
"""
import asyncio
import os
import pathlib
import shutil
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()
PROBLEMS = []

# Retain interval handles so the ordinary economy/autosave timers can be paused
# after boot. Production functions and pointer handlers remain unmodified.
INIT = """(() => {
  window.testIntervals=[];
  const nativeSetInterval=window.setInterval;
  window.setInterval=(...args)=>{
    const id=nativeSetInterval(...args);testIntervals.push(id);return id;
  };
})()"""

HARNESS = """() => {
  sceneStop();testIntervals.forEach(clearInterval);
  window.testSeed=12345;
  Math.random=()=>{testSeed=(Math.imul(testSeed,1664525)+1013904223)>>>0;return testSeed/4294967296;};
  window.testStep=(seconds)=>{
    for(let remaining=seconds;remaining>0.000001;){
      const dt=Math.min(0.05,remaining);scene.t+=dt;updateScene(dt);remaining-=dt;
    }
    drawScene();
  };
  window.testReset=(options={})=>{
    sceneStop();closeSheet();clearTimeout(saveState.timer);
    S=defaultState();S.seenWelcome=true;S.news=NEWS_V;S.sound=false;S.tankLvl=3;
    S.coins=123;S.pile=0.5;S.algae=0;
    S.decor.slots=(options.decor||[null,null,null,null,null]).slice();
    testSeed=12345;scene.t=100;scene.rt.clear();SPRITES.clear();scene.decorMode=false;
    for(const key of ['food','fx','shells','bubbles','parts','ripples']) scene[key].length=0;
    JUICE_Q.length=0;dayLight=()=>1;
    for(const [index,config] of (options.fish||[{trait:'bold',x:55,y:45}]).entries()){
      const species=config.sp||'tetra';
      const f=makeFish(species,founderGenes(SP[species].kind),STAGE_AGE[1]+30);
      Object.assign(f,{name:'Test '+index,trait:config.trait||'bold',hunger:100},config.fish||{});
      delete f.favorite;ensureFavoritePlace(f);ensurePreferredDepth(f);addFish(f);
      const r=rtFor(f),sprite=getSprite(f,stageOf(f),f.sick),kind=kindOf(f);
      const restingY=kind==='shrimp'?floorY(f,sprite):kind==='jelly'?
        (SP[species].floor?SAND_Y+4-sprite.h/2:jellyDepthY(f,sprite)):45;
      Object.assign(r,{x:config.x??55,y:config.y??restingY,tx:config.x??55,ty:config.y??restingY,
        wait:0,chase:0,chaseT:0,flee:0,sleep:false,greeting:null,greetAfter:0});
    }
    updateScene(0);
    for(const f of S.fish){const r=rtFor(f);Object.assign(r,{hop:0,hopV:0,wait:0,tx:r.x,ty:r.y});}
    setTab('tank');drawScene();
    return S.fish.map(f=>f.id);
  };
  window.testFish=()=>S.fish[0];
  window.testRuntime=()=>scene.rt.get(testFish().id);
  window.testDistance=(x,y)=>Math.hypot(testRuntime().x-x,testRuntime().y-y);
}"""


def check(name, ok, details=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f' {details}' if details else ''))
    if not ok:
        PROBLEMS.append(name)


async def boot(context, errors):
    page = await context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.add_init_script(INIT)
    await page.goto(PAGE)
    await page.wait_for_function('S && scene.cv && scene.rt.size > 0')
    await page.evaluate(HARNESS)
    return page


async def reset(page, **options):
    return await page.evaluate('(options)=>testReset(options)', options)


async def tap(page, x, y):
    rect = await page.locator('#scene').bounding_box()
    await page.touchscreen.tap(rect['x'] + x / 160 * rect['width'],
                               rect['y'] + y / 120 * rect['height'])


async def favorites(page):
    await reset(page, decor=['kelp', None, 'castle', None, 'rock'], fish=[
        {'trait': 'shy'}, {'trait': 'bold'}, {'trait': 'lazy'},
        {'sp': 'cherry'}, {'sp': 'moon'}])
    result = await page.evaluate("""() => {
      const fish=S.fish.filter(f=>kindOf(f)==='fish');
      return {valid:fish.every(f=>{
        const p=ensureFavoritePlace(f);
        return p&&S.decor.slots[p.slot]===p.decor&&Number.isFinite(p.x)&&Number.isFinite(p.y)
          &&p.x>=6&&p.x<=154&&p.y>=8&&p.y<=100;
      }),shrimp:S.fish.filter(f=>kindOf(f)==='shrimp').every(f=>!!f.favorite),
      jellies:S.fish.filter(f=>kindOf(f)==='jelly').every(f=>!f.favorite&&Number.isFinite(f.preferredDepth)),
      favorites:fish.map(f=>f.favorite)};
    }""")
    check('fish get valid favorite places beside installed decor', result['valid'], result['favorites'])
    check('shrimp have favorite places and jellies have preferred depths',
          result['shrimp'] and result['jellies'])

    before = await page.evaluate('S.fish.map(f=>f.favorite||null)')
    await page.evaluate('saveNow()')
    await page.reload()
    await page.wait_for_function('S && scene.cv && scene.rt.size > 0')
    await page.evaluate(HARNESS)
    check('favorite places survive a real save and reload',
          await page.evaluate('S.fish.map(f=>f.favorite||null)') == before)

    result = await page.evaluate("""() => {
      const f=S.fish[0],before={...ensureFavoritePlace(f)};
      const next=(before.slot+1)%5;
      S.decor.slots[before.slot]=null;S.decor.slots[next]=before.decor;
      const moved={...ensureFavoritePlace(f)};
      S.decor.slots=S.decor.slots.map(id=>id===before.decor?null:id);
      const removed={...ensureFavoritePlace(f)};
      testStep(0.05);
      S.decor.slots[next]=before.decor;testStep(0.05);
      const replaced={...ensureFavoritePlace(f)};
      return {follows:moved.decor===before.decor&&moved.slot===next,
        moved,removed,replaced,reattaches:replaced.decor===before.decor&&replaced.slot===next,
        validAfterRemoval:removed.decor===null||!!DECOR[removed.decor]};
    }""")
    check('favorite follows its decoration when moved', result['follows'], result['moved'])
    check('removing favorite decoration leaves a valid place', result['validAfterRemoval'], result['removed'])
    check('favorite reconnects after separate remove and replace actions', result['reattaches'], result['replaced'])

    await reset(page)
    result = await page.evaluate("""() => {
      const f=testFish(),a={...ensureFavoritePlace(f)},b={...ensureFavoritePlace(f)};
      S.decor.slots[3]='kelp';
      const decorated={...ensureFavoritePlace(f)};
      return {stable:JSON.stringify(a)===JSON.stringify(b),
        adopted:decorated.decor==='kelp'&&decorated.slot===3,fallback:a,decorated};
    }""")
    check('undecorated tank has a stable fallback place', result['stable'], result['fallback'])
    check('fallback adopts decoration added later', result['adopted'], result['decorated'])

    result = await page.evaluate("""() => {
      const source=JSON.parse(serialize());delete source.fish[0].favorite;
      const migrate=raw=>{S=normalize(JSON.parse(JSON.stringify(raw)));scene.rt.clear();updateScene(0);
        return {...ensureFavoritePlace(S.fish[0])};};
      const a=migrate(source),b=migrate(source);
      const invalid=[null,'broken',{}, {decor:'missing',slot:99,x:1e99,y:-1e99},
        {decor:'kelp',slot:-1,x:'oops',y:null}];
      const valid=invalid.every(favorite=>{
        const raw=JSON.parse(JSON.stringify(source));raw.fish[0].favorite=favorite;
        const p=migrate(raw);
        return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=6&&p.x<=154&&p.y>=8&&p.y<=100
          &&Number.isInteger(p.slot)&&p.slot>=0&&p.slot<5&&(p.decor===null||!!DECOR[p.decor]);
      });
      return {stable:JSON.stringify(a)===JSON.stringify(b),valid};
    }""")
    check('legacy saves acquire deterministic favorite places', result['stable'])
    check('malformed saved favorite places are repaired safely', result['valid'])

    await reset(page, decor=['kelp', None, None, None, None])
    result = await page.evaluate("""() => {
      const f=testFish(),r=testRuntime(),random=Math.random;
      try{Math.random=()=>0;pickFishTarget(f,r,SP[f.sp],stageOf(f),0);}
      finally{Math.random=random;}
      return r.visitingHome&&Math.hypot(r.tx-f.favorite.x,r.ty-f.favorite.y)<6;
    }""")
    check('ordinary swimming sometimes targets the saved favorite', result)


async def inhabitant_habits(page):
    species = ['cherry', 'ghost', 'amano', 'moon', 'nettle', 'mat', 'comb', 'immortal', 'box']
    await reset(page, decor=['castle', 'rock', None, 'kelp', None], fish=[
        {'sp': sp, 'trait': 'shy'} for sp in species])
    result = await page.evaluate("""() => {
      return {shrimp:S.fish.filter(f=>kindOf(f)==='shrimp').every(f=>
        f.favorite&&(f.favorite.decor==='rock'||DECOR[f.favorite.decor]?.plant)),
        jellies:S.fish.filter(f=>kindOf(f)==='jelly').every(f=>
          !f.favorite&&(SP[f.sp].floor?f.preferredDepth===.98:f.preferredDepth>=.15&&f.preferredDepth<=.8))};
    }""")
    check('shrimp choose rock/plant shelter and every jelly species has a safe depth',
          all(result.values()), result)
    before = await page.evaluate('S.fish.map(f=>({favorite:f.favorite||null,depth:f.preferredDepth??null}))')
    await page.evaluate('saveNow()')
    await page.reload()
    await page.wait_for_function('S && scene.cv && scene.rt.size > 0')
    await page.evaluate(HARNESS)
    check('shrimp favorites and jelly depths survive a real save and reload',
          await page.evaluate('S.fish.map(f=>({favorite:f.favorite||null,depth:f.preferredDepth??null}))') == before)
    result = await page.evaluate("""async () => {
      const habits=state=>JSON.stringify(state.fish.map(f=>({favorite:f.favorite||null,depth:f.preferredDepth??null})));
      const before=habits(S),code=await makeBackupCode(),restored=normalize(await readBackupCode(code));
      return {matches:habits(restored)===before,format:/^FIN1z?:/.test(code)};
    }""")
    check('all new saved habits survive a real backup-code encode/decode round trip',
          all(result.values()), result)

    result = await page.evaluate("""() => {
      const shrimp=S.fish.filter(f=>kindOf(f)==='shrimp');
      return shrimp.every(f=>{
        const home={...f.favorite},slot=home.slot===4?0:4;
        S.decor.slots[home.slot]=null;S.decor.slots[slot]=home.decor;ensureFavoritePlace(f);
        const moved=f.favorite.slot===slot&&f.favorite.decor===home.decor;
        S.decor.slots[slot]=null;ensureFavoritePlace(f);
        const fallback=Number.isFinite(f.favorite.x)&&f.favorite.preferred===home.decor;
        S.decor.slots[slot]=home.decor;ensureFavoritePlace(f);
        return moved&&fallback&&f.favorite.slot===slot&&f.favorite.decor===home.decor;
      });
    }""")
    check('shrimp favorites follow moved, removed, and replaced shelter', result)
    result = await page.evaluate("""() => {
      const raw=JSON.parse(serialize());
      for(const f of raw.fish){delete f.favorite;delete f.preferredDepth;}
      const migrate=source=>normalize(JSON.parse(JSON.stringify(source)));
      const habits=state=>JSON.stringify(state.fish.map(f=>({favorite:f.favorite||null,depth:f.preferredDepth??null})));
      const a=migrate(raw),b=migrate(raw);
      for(const f of raw.fish){f.favorite={decor:'missing',slot:999,x:'bad',y:-999};f.preferredDepth='broken';}
      const repaired=migrate(raw);
      return {stable:habits(a)===habits(b),valid:repaired.fish.every(f=>kindOf(f)==='shrimp'?
        Number.isFinite(f.favorite.x)&&Number.isFinite(f.favorite.y):
        Number.isFinite(f.preferredDepth)&&(SP[f.sp].floor?f.preferredDepth===.98:f.preferredDepth>=.15&&f.preferredDepth<=.8))};
    }""")
    check('legacy and malformed non-fish habits migrate deterministically', all(result.values()), result)


async def nonfish_greetings(page):
    # Exercise real pointer routing once per movement style, then inspect all traits.
    for sp in ['cherry', 'moon', 'mat', 'comb']:
        await reset(page, fish=[{'sp': sp}])
        y = await page.evaluate('Math.min(testRuntime().y,99)')
        await tap(page, 90, y)
        phase = 'freeze' if sp == 'cherry' else 'drift'
        check(f'empty-glass touch starts the {sp} response without opening details',
              await page.evaluate('(phase)=>testRuntime().greeting?.phase===phase&&!sheetState', phase))

    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['cherry','ghost','amano'])for(const {id:trait} of TRAITS){
        testReset({fish:[{sp,trait}]});const f=testFish(),r=testRuntime(),origin=r.x;
        const fy=floorY(f,getSprite(f,stageOf(f),f.sick));waterTap(90,99);
        let valid=r.greeting?.phase==='freeze',retreat=false,returned=false,start=null,closest=Infinity,maxStep=0;
        testStep(.1);valid=valid&&r.x===origin;
        for(let i=0;i<600&&r.greeting;i++){
          const x=r.x;testStep(.05);maxStep=Math.max(maxStep,Math.abs(r.x-x));
          valid=valid&&r.y===fy&&r.hop===0&&Number.isFinite(r.x)&&r.x>=6&&r.x<=154;
          if(r.greeting?.phase==='retreat')retreat=true;
          if(r.greeting?.phase==='return'){returned=true;const d=Math.abs(r.x-origin);if(start===null)start=d;closest=Math.min(closest,d);}
        }
        valid=valid&&!r.greeting&&maxStep<1&&!scene.fx.some(e=>e.type==='heart');
        valid=valid&&(trait==='lazy'?r.x===origin:retreat&&returned&&closest<start&&Math.abs(r.x-origin)<3);
        if(!valid)failures.push(sp+' '+trait);
      }
      return failures;
    }""")
    check('all shrimp species and traits freeze, retreat, and return gently on the sand', not result, result)

    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['moon','nettle','mat','comb','immortal','box'])for(const {id:trait} of TRAITS){
        testReset({fish:[{sp,trait}]});const f=testFish(),r=testRuntime(),sprite=getSprite(f,stageOf(f),f.sick);
        const origin=r.x,depth=f.preferredDepth;waterTap(90,Math.min(r.y,99));
        let valid=r.greeting?.phase==='drift'&&Math.abs(r.greeting.courseX-origin)<=12,maxStep=0,pulsed=false;
        for(let i=0;i<200&&r.greeting;i++){
          const {x,y,pp}=r;testStep(.05);maxStep=Math.max(maxStep,Math.hypot(r.x-x,r.y-y));pulsed=pulsed||r.pp!==pp;
          valid=valid&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.x>=6&&r.x<=154&&
            (!r.greeting||r.greeting.phase==='drift')&&!r.chase;
          if(SP[sp].floor)valid=valid&&r.y===SAND_Y+4-sprite.h/2;
          else valid=valid&&r.y>=8&&r.y<=SAND_Y-sprite.h/2-4;
        }
        valid=valid&&!r.greeting&&pulsed&&maxStep<=Math.hypot(SP[sp].spd*16*traitSpeed(trait)*1.4*.05,.6)+1e-8&&f.preferredDepth===depth&&!scene.fx.some(e=>e.type==='heart');
        if(!valid)failures.push(sp+' '+trait);
      }
      return failures;
    }""")
    check('all jelly species and traits keep gentle native motion, floor posture, and comb glide', not result, result)
    result = await page.evaluate("""() => {
      return ['moon','nettle','immortal','box'].every(sp=>{
        testReset({fish:[{sp}]});const f=testFish(),r=testRuntime(),s=getSprite(f,stageOf(f),f.sick);
        r.tx=r.x;r.wait=.1;const before=r.tx;
        moveJelly(f,r,SP[sp],stageOf(f),0,.05,5,false,s);const paused=r.tx===before;
        moveJelly(f,r,SP[sp],stageOf(f),0,.06,5,false,s);
        return paused&&r.tx!==before&&Math.abs(r.ty-jellyDepthY(f,s))<=6;
      });
    }""")
    check('native jellies resume wandering when their near-target pause ends', result)


    await reset(page, fish=[{'sp': sp} for sp in ['tetra', 'cherry', 'moon', 'ghost', 'comb']])
    result = await page.evaluate("""() => {
      waterTap(85,80);const active=S.fish.filter(f=>rtFor(f).greeting);
      const before=active.map(f=>JSON.stringify(rtFor(f).greeting));
      for(let i=0;i<100;i++)waterTap(85,80);
      return {count:S.fish.filter(f=>rtFor(f).greeting).length,
        unchanged:active.every((f,i)=>JSON.stringify(rtFor(f).greeting)===before[i]),
        bounded:scene.ripples.length<=16&&scene.parts.length<=221};
    }""")
    check('fish, shrimp, and jellies share the three-creature response cap', result['count'] == 3, result)
    check('repeated mixed-tank taps preserve current responses and effect caps',
          result['unchanged'] and result['bounded'])

    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['cherry','moon','mat','comb']){
        testReset({fish:[{sp}]});const r=testRuntime();waterTap(90,Math.min(r.y,99));
        while(r.greeting&&scene.t<111.5)testStep(.05);
        const ended=!r.greeting;waterTap(90,Math.min(r.y,99));const resting=!r.greeting;
        testStep(13);Object.assign(r,{x:55,hop:0});waterTap(90,Math.min(r.y,99));
        if(!(ended&&resting&&r.greeting))failures.push(sp);
      }
      return failures;
    }""")
    check('shrimp and jelly cooldowns prevent instant restarts but permit later responses', not result, result)

    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['cherry','ghost','amano','moon','nettle','mat','comb','immortal','box']){
        testReset({fish:[{sp}]});const before=JSON.stringify(S);waterTap(90,Math.min(testRuntime().y,99));testStep(24);
        if(JSON.stringify(S)!==before)failures.push(sp);
      }
      return failures;
    }""")
    check('non-fish responses change no economy, health, hunger, genetics, or progression', not result, result)
    check('new reactions and foraging stay out of saved creature data',
          await page.evaluate("!JSON.parse(serialize()).fish.some(f=>'greeting' in f||'greetAfter' in f||'foraging' in f)"))

    for sp in ['cherry', 'moon', 'mat', 'comb']:
        await reset(page, fish=[{'sp': sp}])
        point = await page.evaluate('({x:testRuntime().x,y:testRuntime().y})')
        await tap(page, point['x'], point['y'])
        check(f'direct {sp} touch still opens its details',
              await page.evaluate("sheetState?.kind==='fish'&&sheetState.arg===testFish().id&&!testRuntime().greeting"))


async def nonfish_priorities(page):
    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['cherry','moon','mat','comb'])for(const priority of ['food','sleep','sick','flee']){
        testReset({fish:[{sp}]});const f=testFish(),r=testRuntime();waterTap(90,Math.min(r.y,99));
        const started=!!r.greeting;
        if(priority==='food'){f.hunger=50;scene.food.push({x:120,y:kindOf(f)==='shrimp'?103:50,vy:0,t:10,floor:true});}
        if(priority==='sleep')dayLight=()=>0;
        if(priority==='sick')f.sick=true;
        if(priority==='flee'){r.flee=1;r.tx=140;r.ty=70;}
        testStep(.05);let valid=started&&!r.greeting;
        if(priority==='food'&&kindOf(f)==='shrimp')valid=valid&&r.tx===120;
        if(priority==='flee')valid=valid&&r.tx===140&&r.ty===70;
        waterTap(90,Math.min(r.y,99));valid=valid&&!r.greeting;
        if(!valid)failures.push(sp+' '+priority);
      }
      return failures;
    }""")
    check('food, sleep, sickness, and fleeing interrupt every non-fish movement style safely', not result, result)
    await reset(page, fish=[])
    result = await page.evaluate("""() => {
      const p=newPolyp('moon',founderGenes('jelly'));S.polyps.push(p);const before=JSON.stringify(p);
      for(let i=0;i<20;i++){waterTap(30,99);testStep(.5);}
      return {still:JSON.stringify(p)===before,runtime:scene.rt.size===0,
        noHabits:p.favorite===undefined&&p.preferredDepth===undefined};
    }""")
    check('polyps remain stationary without swimmer runtime or preferences', all(result.values()), result)


async def greetings(page):
    await reset(page)
    economy = await page.evaluate('JSON.stringify(S)')
    before = await page.evaluate('testDistance(95,45)')
    await tap(page, 95, 45)
    check('touching empty glass starts curious approach without a sheet',
          await page.evaluate("testRuntime().greeting?.phase==='approach' && !sheetState"))
    await page.evaluate('testStep(1)')
    check('curious fish actually swims toward the tap', await page.evaluate('testDistance(95,45)') < before)
    await page.evaluate('testStep(25)')
    check('greeting ends and releases fish back to ordinary swimming',
          await page.evaluate('!testRuntime().greeting'))
    check('glass greetings do not alter economy, health, hunger, genetics, or progression',
          await page.evaluate('JSON.stringify(S)') == economy)

    await reset(page, fish=[{'trait': 'shy', 'x': 70, 'y': 45}])
    before = await page.evaluate('testDistance(95,45)')
    await tap(page, 95, 45)
    check('shy fish begins with a retreat', await page.evaluate("testRuntime().greeting?.phase==='retreat'"))
    await page.evaluate('testStep(0.5)')
    retreat = await page.evaluate('testDistance(95,45)')
    check('shy retreat moves away from the tap', retreat > before)
    result = await page.evaluate("""() => {
      let returned=false,start=null,closest=Infinity;
      for(let i=0;i<240;i++){
        testStep(0.05);
        if(testRuntime().greeting?.phase==='approach'){
          const d=testDistance(95,45);if(start===null)start=d;closest=Math.min(closest,d);returned=true;
        }
      }
      return {returned,start,closest,finished:!testRuntime().greeting};
    }""")
    check('shy fish returns cautiously after retreating',
          result['returned'] and result['closest'] < result['start'], result)
    await page.evaluate('testStep(5)')
    check('shy greeting also expires', await page.evaluate('!testRuntime().greeting'))

    await reset(page, fish=[{'trait': 'bold', 'x': 45 + 8 * i, 'y': 45} for i in range(7)])
    result = await page.evaluate("""() => {
      waterTap(100,45);
      const before=S.fish.map(f=>{const r=rtFor(f);return {id:f.id,g:r.greeting&&JSON.stringify(r.greeting)}});
      for(let i=0;i<100;i++)waterTap(100,45);
      const active=S.fish.filter(f=>rtFor(f).greeting);
      return {count:active.length,
        unchanged:before.filter(v=>v.g).every(v=>JSON.stringify(scene.rt.get(v.id).greeting)===v.g),
        ripples:scene.ripples.length,parts:scene.parts.length};
    }""")
    check('repeated taps keep the greeting crowd bounded', 0 < result['count'] <= 3, result)
    check('repeated taps do not restart active reactions', result['unchanged'])
    check('repeated taps keep visual effect buffers bounded', result['ripples'] <= 16 and result['parts'] <= 221)
    await page.evaluate('testStep(25)')
    check('all repeated-tap reactions eventually clear',
          await page.evaluate('S.fish.every(f=>!rtFor(f).greeting)'))

    await reset(page)
    result = await page.evaluate("""() => {
      waterTap(95,45);testStep(6);
      const ended=!testRuntime().greeting;
      Object.assign(testRuntime(),{x:55,y:45});waterTap(95,45);
      const resting=!testRuntime().greeting;
      testStep(6.1);Object.assign(testRuntime(),{x:55,y:45});waterTap(95,45);
      return {ended,resting,returns:!!testRuntime().greeting};
    }""")
    check('per-fish cooldown prevents instant restarts and permits later greetings',
          all(result.values()), result)

    await reset(page, fish=[{'trait': 'lazy'}])
    result = await page.evaluate("""() => {
      const {x,y}=testRuntime();waterTap(95,45);
      const watches=testRuntime().greeting?.phase==='watch';testStep(1);
      return watches&&testRuntime().x===x&&testRuntime().y===y;
    }""")
    check('lazy fish watches without rushing toward the glass', result)

    await reset(page, fish=[{'trait': 'social', 'sp': 'pleco', 'x': 35, 'y': 45}])
    result = await page.evaluate("""() => {
      waterTap(105,45);let lingered=false;
      for(let i=0;i<500;i++){testStep(0.05);if(testRuntime().greeting?.phase==='linger')lingered=true;}
      return {lingered,finished:!testRuntime().greeting};
    }""")
    check('slow fish have enough time to reach and linger near the greeting',
          result['lingered'] and result['finished'], result)

    await reset(page)
    await page.evaluate('waterTap(95,45)')
    check('runtime greetings stay out of the saved tank',
          await page.evaluate("!JSON.parse(serialize()).fish.some(f=>'greeting' in f || 'greetAfter' in f)"))
    await tap(page, 55, 45)
    check('direct fish tap still opens that fish’s details',
          await page.evaluate("sheetState?.kind==='fish' && sheetState.arg===testFish().id"))


async def priorities(page):
    await reset(page)
    result = await page.evaluate("""() => {
      testFish().hunger=50;scene.food.push({x:20,y:20,vy:0,floor:false,t:0});
      waterTap(95,45);testStep(0.05);
      return {skipped:!testRuntime().greeting,food:testRuntime().tx===20&&testRuntime().ty===20};
    }""")
    check('hungry fish prioritize food over a new greeting', result['skipped'] and result['food'])

    await reset(page)
    result = await page.evaluate("""() => {
      waterTap(95,45);const started=!!testRuntime().greeting;
      testFish().hunger=50;scene.food.push({x:20,y:20,vy:0,floor:false,t:0});testStep(0.05);
      return started&&!testRuntime().greeting&&testRuntime().tx===20&&testRuntime().ty===20;
    }""")
    check('food arriving interrupts an existing greeting', result)

    await reset(page)
    result = await page.evaluate("""() => {
      dayLight=()=>0;testStep(0.05);waterTap(95,45);
      return testRuntime().sleep&&!testRuntime().greeting;
    }""")
    check('sleeping fish are not woken by glass taps', result)

    await reset(page)
    result = await page.evaluate("""() => {
      waterTap(95,45);const started=!!testRuntime().greeting;
      dayLight=()=>0;testStep(0.05);
      return started&&testRuntime().sleep&&!testRuntime().greeting;
    }""")
    check('nightfall interrupts a greeting', result)

    await reset(page)
    result = await page.evaluate("""() => {
      waterTap(95,45);const started=!!testRuntime().greeting;
      const r=testRuntime();r.flee=0.9;r.tx=15;r.ty=70;testStep(0.05);
      return started&&!r.greeting&&r.tx===15&&r.ty===70&&r.x<55;
    }""")
    check('avoidance interrupts a greeting without losing its escape target', result)

    await reset(page, fish=[{'fish': {'sick': True}},
                            {'sp': 'cherry', 'fish': {'sick': True}},
                            {'sp': 'moon', 'fish': {'sick': True}}])
    await page.evaluate('waterTap(95,45)')
    check('sick fish, shrimp, and jellyfish do not receive glass responses',
          await page.evaluate('S.fish.every(f=>!rtFor(f).greeting)'))

    await reset(page)
    await page.evaluate("""() => {
      scene.decorMode=true;window.testDecorEvents=[];
      for(const type of ['pointerdown','pointerup','click'])
        document.addEventListener(type,e=>testDecorEvents.push({type,target:e.target.id,
          kind:sheetState?.kind??null,arg:sheetState?.arg??null}),{once:true});
    }""")
    await tap(page, 80, 108)
    result = await page.evaluate("""() => ({kind:sheetState?.kind??null,
      arg:sheetState?.arg??null,greeting:!!testRuntime().greeting,events:testDecorEvents})""")
    check('decoration-slot taps still open decoration controls',
          result['kind'] == 'decor' and result['arg'] == 2 and not result['greeting'], result)


async def reduced_motion(browser, errors):
    context = await browser.new_context(viewport={'width': 320, 'height': 640},
                                        is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = await boot(context, errors)
    await screenshot_fixture(page)
    await tap(page, 95, 30)
    await page.evaluate('testStep(0.35)')
    check('reduced-motion screenshot has no ripple or particle bursts',
          await page.evaluate('REDUCED && scene.ripples.length===0 && scene.parts.length===0'))
    await capture(page, 'fish-personality-reduced-motion.png')
    await reset(page)
    await tap(page, 95, 45)
    check('reduced-motion setting is detected', await page.evaluate('REDUCED'))
    check('reduced-motion tap avoids ripple and particle bursts',
          await page.evaluate('scene.ripples.length===0 && scene.parts.length===0'))
    result = await page.evaluate("""() => {
      let finite=true,maxStep=0;
      for(let i=0;i<400;i++){
        const {x,y}=testRuntime();testStep(0.05);const r=testRuntime();
        maxStep=Math.max(maxStep,Math.hypot(r.x-x,r.y-y));
        finite=finite&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.x>=6&&r.x<=154&&r.y>=8&&r.y<=100;
      }
      return {finite,maxStep,finished:!testRuntime().greeting};
    }""")
    check('reduced-motion reactions stay smooth, bounded, and finite',
          result['finite'] and result['maxStep'] < 4 and result['finished'], result)
    result = await page.evaluate("""() => {
      const failures=[];
      for(const sp of ['cherry','moon','mat','comb']){
        testReset({fish:[{sp}]});const f=testFish(),r=testRuntime(),sprite=getSprite(f,stageOf(f),f.sick);
        waterTap(90,Math.min(r.y,99));let valid=!!r.greeting,maxStep=0;
        for(let i=0;i<300;i++){
          const {x,y}=r;testStep(.05);maxStep=Math.max(maxStep,Math.hypot(r.x-x,r.y-y));
          valid=valid&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.x>=6&&r.x<=154;
          if(r.greeting&&kindOf(f)==='shrimp')valid=valid&&r.y===floorY(f,sprite)&&r.hop===0;
          if(SP[sp].floor)valid=valid&&r.y===SAND_Y+4-sprite.h/2;
        }
        valid=valid&&!r.greeting&&maxStep<2&&scene.parts.length===0&&scene.ripples.length===0&&!scene.fx.some(e=>e.type==='heart');
        if(!valid)failures.push(sp);
      }
      return failures;
    }""")
    check('reduced-motion shrimp and jelly responses stay bounded without bursts or hearts', not result, result)
    check('narrow mobile layout has no horizontal overflow',
          await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    await context.close()


async def screenshot_fixture(page):
    # This is a synthetic tank in an isolated browser context, never a user save.
    # Reset visual easing/ambient state left by earlier tests before reseeding it.
    await page.evaluate("""() => {
      scene.snow.length=0;
      scene.vw=scene.va=scene.wipe=scene.swirl=scene.rinse=scene.pileN=null;
      clearTimeout(toastTimer);$('#toast').hidden=true;
    }""")
    await reset(page, decor=['kelp', 'rock', None, 'castle', 'redweed'], fish=[
        {'trait': 'shy', 'x': 37, 'y': 65, 'fish': {'name': 'Moss'}},
        {'trait': 'bold', 'sp': 'guppy', 'x': 72, 'y': 42, 'fish': {'name': 'Sunny'}},
        {'trait': 'social', 'sp': 'goldie', 'x': 111, 'y': 64, 'fish': {'name': 'Goldie'}},
        {'trait': 'shy', 'sp': 'cherry', 'x': 69, 'fish': {'name': 'Cherry'}},
        {'trait': 'lazy', 'sp': 'moon', 'x': 124, 'y': 32, 'fish': {'name': 'Moon'}},
    ])
    await page.evaluate("""() => {
      // addFish queues arrivals/discoveries; they are not part of this settled tank.
      JUICE_Q.length=0;
      for(const key of ['parts','ripples','fx']) scene[key].length=0;
      for(const r of scene.rt.values()) r.sq=0;
      snapCoins();renderSoundBtn();drawScene();
    }""")
    check('screenshot tank contains fish, shrimp, and jellyfish',
          await page.evaluate("['fish','shrimp','jelly'].every(kind=>S.fish.some(f=>kindOf(f)===kind && scene.rt.has(f.id)))"))


async def capture(page, filename):
    await page.evaluate("""async () => {
      await document.fonts.ready;
      // The harness stops requestAnimationFrame, so capture the fixture explicitly.
      sceneStop();drawScene();
      // DNA has its own animation loop, independent of the tank scene.
      cancelAnimationFrame(hxRaf);hxRaf=0;hxPhase=0.6;
      const helix=document.querySelector('.hx-svg');
      if(helix&&hxRows) helix.innerHTML=helixInner(hxRows,hxPhase);
    }""")
    check(filename + ' has a painted tank canvas', await page.evaluate("""() => {
      const pixels=scene.c.getImageData(0,0,scene.cv.width,scene.cv.height).data;
      return pixels.some((value,index)=>index%4===3&&value>0);
    }"""))
    await page.screenshot(path=str(ROOT / 'tests' / filename), animations='disabled')
    print('SCREENSHOT tests/' + filename)


async def screenshots(page):
    await screenshot_fixture(page)
    check('phone screenshot layout has no horizontal overflow',
          await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    await capture(page, 'fish-personality-tank.png')
    for kind, label, filename in [
        ('fish', 'Favorite spot', 'fish-personality-details.png'),
        ('shrimp', 'Favorite spot', 'fish-personality-shrimp-details.png'),
        ('jelly', 'Favorite depth', 'fish-personality-jelly-details.png'),
    ]:
        await page.evaluate("""kind => {
          openSheet('fish',S.fish.find(f=>kindOf(f)===kind).id);
          $('#sheetPanel').scrollTop=0;
        }""", kind)
        # innerText includes CSS text-transform: uppercase on the habit labels.
        text = (await page.inner_text('#sheetPanel')).casefold()
        check(kind + ' details explain the favorite place and glass response',
              label.casefold() in text and 'say hello' in text)
        # The sheet has its own scroller. Keep the complete greeting row and the
        # favorite row immediately above it visible, even below the first fold.
        await page.locator('#sheetPanel .r').filter(
            has=page.get_by_text('Say hello', exact=True)).scroll_into_view_if_needed()
        await capture(page, filename)
        await page.locator('#sheetPanel').get_by_role('button', name='Close', exact=True).click()
        check(kind + ' detail sheet closes', await page.locator('#sheet').is_hidden())
    await tap(page, 95, 30)
    await page.evaluate('testStep(0.35)')
    check('glass-greeting screenshot includes an active response',
          await page.evaluate('S.fish.some(f=>!!rtFor(f).greeting)'))
    await capture(page, 'fish-personality-greeting.png')


async def desktop_screenshot(browser, errors):
    context = await browser.new_context(viewport={'width': 1280, 'height': 900})
    try:
        page = await boot(context, errors)
        await screenshot_fixture(page)
        check('desktop layout stays centered without horizontal overflow',
              await page.evaluate("""() => {
                const r=$('#app').getBoundingClientRect();
                return document.documentElement.scrollWidth<=innerWidth && r.width<=560
                  && Math.abs(r.left-(innerWidth-r.right))<2;
              }"""))
        await capture(page, 'fish-personality-desktop-tank.png')
    finally:
        await context.close()


async def main():
    errors = []
    async with async_playwright() as p:
        executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
        if not executable and not pathlib.Path(p.chromium.executable_path).exists():
            executable = shutil.which('chromium') or shutil.which('chromium-browser')
        browser = await p.chromium.launch(**({'executable_path': executable} if executable else {}))
        try:
            context = await browser.new_context(viewport={'width': 390, 'height': 844},
                                                is_mobile=True, has_touch=True)
            page = await boot(context, errors)
            # Capture visual QA before behavioral failures can interrupt the run.
            await screenshots(page)
            await desktop_screenshot(browser, errors)
            await reduced_motion(browser, errors)
            await favorites(page)
            await inhabitant_habits(page)
            await greetings(page)
            await nonfish_greetings(page)
            await priorities(page)
            await nonfish_priorities(page)
            check('no browser script errors', not errors, errors)
        finally:
            await browser.close()
    if PROBLEMS:
        print(f'\n{len(PROBLEMS)} failed check(s): ' + ', '.join(PROBLEMS))
    sys.exit(1 if PROBLEMS else 0)


if __name__ == '__main__':
    asyncio.run(main())
