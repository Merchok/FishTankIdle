"""Quick smoke test: loads dist/index.html in a phone-sized browser and pokes the main features.

    pip install playwright && playwright install chromium
    bash build.sh
    python tests/smoke.py
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
SETUP = """()=>{
  S.fish=[];S.tankLvl=3;S.coins=300;S.waste=60;S.algae=70;
  for(const id of ['tetra','guppy','goldie','cherry','moon','danio','comb','box'])
    addFish(makeFish(id,founderGenes(SP[id].kind),STAGE_AGE[1]+30));
  S.pile=40.5;changed();
}"""

async def main():
    problems = []
    def check(name, ok, extra=''):
        print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if extra != '' else ''))
        if not ok: problems.append(name)

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        # the sandboxed test box can't reach Google Fonts; that is not a game bug
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)

        await page.goto(PAGE)
        await page.wait_for_timeout(1200)
        check('welcome sheet on first run', await page.evaluate("sheetState&&sheetState.kind") == 'welcome')
        await page.click('[data-act=close] >> nth=-1')
        await page.evaluate(SETUP)
        await page.wait_for_timeout(800)

        before = await page.evaluate("S.coins")
        await page.click('[data-act=collect]')
        await page.wait_for_timeout(2600)
        after = await page.evaluate("[S.coins,$('#coins').textContent,coinView.hold]")
        check('collect: coins added, counter caught up', after[0] == before + 40 and str(after[0]) == after[1] and after[2] == 0, after)

        await page.click('[data-act=feed]')
        await page.wait_for_timeout(300)
        check('feed drops flakes', await page.evaluate("scene.food.length") > 0)

        await page.click('[data-act=scrub]')
        await page.wait_for_timeout(1400)
        algae = await page.evaluate("S.algae"); check("scrub cleans the glass", algae < 3, algae)

        await page.click('[data-act=water]')
        await page.wait_for_timeout(1800)
        check('water change lowers waste', await page.evaluate("S.waste") < 20)

        await page.click('#tabs [data-tab=shop]')
        await page.wait_for_timeout(300)
        n = await page.evaluate("S.fish.length")
        await page.click('[data-act=buy-fish] >> nth=0')
        await page.wait_for_timeout(500)
        check('buying a fish adds it', await page.evaluate("S.fish.length") == n + 1)

        for tab in ['fish', 'breed', 'book', 'tank']:
            await page.click(f'#tabs [data-tab={tab}]')
            await page.wait_for_timeout(200)

        await page.evaluate("saveNow()")
        await page.reload()
        await page.wait_for_timeout(1200)
        check('save survives a reload', await page.evaluate("S.fish.length") == n + 1)

        check('no script errors', not errs, errs)
        await b.close()
    sys.exit(1 if problems else 0)

asyncio.run(main())
