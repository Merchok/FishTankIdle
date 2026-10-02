"""Behavioral regression tests for favorite places and gentle glass greetings.

    bash build.sh
    python tests/fish_personality.py

Uses a phone-sized touch browser. Scene time is advanced deterministically, while
the economy timer is paused, so assertions do not depend on wall-clock timing,
the time of day, or random swimming. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a
specific browser; a system Chromium is used when Playwright's download is absent.
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
    scene.t=100;scene.rt.clear();scene.decorMode=false;
    for(const key of ['food','fx','shells','bubbles','parts','ripples']) scene[key].length=0;
    JUICE_Q.length=0;dayLight=()=>1;
    for(const [index,config] of (options.fish||[{trait:'bold',x:55,y:45}]).entries()){
      const species=config.sp||'tetra';
      const f=makeFish(species,founderGenes(SP[species].kind),STAGE_AGE[1]+30);
      Object.assign(f,{name:'Test '+index,trait:config.trait||'bold',hunger:100},config.fish||{});
      addFish(f);
      const r=rtFor(f);
      Object.assign(r,{x:config.x??55,y:config.y??45,tx:config.x??55,ty:config.y??45,
        wait:0,chase:0,chaseT:0,flee:0,sleep:false,greeting:null,greetAfter:0});
    }
    updateScene(0);setTab('tank');drawScene();
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
      }),nonfish:S.fish.filter(f=>kindOf(f)!=='fish').every(f=>!f.favorite),
      favorites:fish.map(f=>f.favorite)};
    }""")
    check('fish get valid favorite places beside installed decor', result['valid'], result['favorites'])
    check('shrimp and jellyfish keep their existing behavior', result['nonfish'])

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

    await reset(page, fish=[{'fish': {'sick': True}}, {'sp': 'cherry'}, {'sp': 'moon'}])
    await page.evaluate('waterTap(95,45)')
    check('sick fish, shrimp, and jellyfish do not receive fish greetings',
          await page.evaluate('S.fish.every(f=>!rtFor(f).greeting)'))

    await reset(page)
    await page.evaluate('scene.decorMode=true')
    await tap(page, 80, 108)
    check('decoration-slot taps still open decoration controls',
          await page.evaluate("sheetState?.kind==='decor' && sheetState.arg===2 && !testRuntime().greeting"))


async def reduced_motion(browser, errors):
    context = await browser.new_context(viewport={'width': 320, 'height': 640},
                                        is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = await boot(context, errors)
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
    check('narrow mobile layout has no horizontal overflow',
          await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    await context.close()


async def screenshots(page):
    await reset(page, decor=['kelp', 'rock', None, 'castle', 'redweed'], fish=[
        {'trait': 'shy', 'x': 37, 'y': 79},
        {'trait': 'bold', 'sp': 'guppy', 'x': 72, 'y': 45},
        {'trait': 'social', 'sp': 'goldie', 'x': 115, 'y': 56},
        {'sp': 'cherry', 'x': 65, 'y': 99},
    ])
    await page.screenshot(path=str(ROOT / 'tests' / 'fish-personality-tank.png'))
    await page.evaluate("openSheet('fish',S.fish[0].id)")
    check('fish details explain the favorite spot', 'Favorite spot' in await page.inner_text('#sheetPanel'))
    await page.screenshot(path=str(ROOT / 'tests' / 'fish-personality-details.png'))


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
            await favorites(page)
            await greetings(page)
            await priorities(page)
            await screenshots(page)
            await reduced_motion(browser, errors)
            check('no browser script errors', not errors, errors)
        finally:
            await browser.close()
    if PROBLEMS:
        print(f'\n{len(PROBLEMS)} failed check(s): ' + ', '.join(PROBLEMS))
    sys.exit(1 if PROBLEMS else 0)


if __name__ == '__main__':
    asyncio.run(main())
