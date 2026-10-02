"""Offline / install test. Serves dist/ like GitHub Pages does (under a sub-folder), lets the
service worker save the game, then STOPS the server and checks the game still opens.

    pip install playwright && playwright install chromium
    bash build.sh
    python tests/offline.py
"""
import asyncio, json, os, pathlib, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8765
BASE = f'http://127.0.0.1:{PORT}/FishTankIdle/'
problems = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if extra != '' else ''))
    if not ok: problems.append(name)

def serve(directory):
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', str(directory)],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/', timeout=1); return p
        except Exception: time.sleep(0.1)
    raise RuntimeError('server did not start')

async def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    site = tmp / 'site'
    shutil.copytree(ROOT / 'dist', site / 'FishTankIdle')     # same sub-path layout as GitHub Pages
    server = serve(site)
    async with async_playwright() as p:
        executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
        if not executable and not pathlib.Path(p.chromium.executable_path).exists():
            executable = shutil.which('chromium') or shutil.which('chromium-browser')
        launch_options = {'executable_path': executable} if executable else {}
        b = await p.chromium.launch(**launch_options)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        errs, outside = [], set()
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: outside.add(r.url) if not r.url.startswith(f'http://127.0.0.1:{PORT}') and not r.url.startswith('data:') else None)

        # ---- first visit (online) ----
        await page.goto(BASE)
        await page.wait_for_timeout(1500)
        await page.click('[data-act=close] >> nth=-1')
        await page.evaluate("""()=>{S.fish=[];S.tankLvl=2;S.coins=321;
          for(const id of ['tetra','guppy','moon']) addFish(makeFish(id,founderGenes(SP[id].kind),STAGE_AGE[1]+30));
          changed();saveNow();}""")
        ready = await page.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)")
        check('service worker is active', ready)
        await page.wait_for_timeout(800)
        keys = await page.evaluate("caches.keys()")
        cached = await page.evaluate("caches.open(%s).then(c=>c.keys()).then(ks=>ks.map(k=>new URL(k.url).pathname))" % json.dumps(keys[0] if keys else 'x'))
        check('one versioned cache', len(keys) == 1 and keys[0].startswith('finlings-'), keys)
        need = ['/FishTankIdle/', '/FishTankIdle/index.html', '/FishTankIdle/manifest.webmanifest', '/FishTankIdle/icons/icon-192.png', '/FishTankIdle/icons/icon-512.png', '/FishTankIdle/icons/apple-touch-icon.png']
        check('everything needed is saved', all(n in cached for n in need), [n for n in need if n not in cached])
        mf = await page.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json())")
        check('manifest is valid', mf.get('display') == 'standalone' and mf.get('start_url') == './' and len(mf.get('icons', [])) >= 2)
        check('fonts are bundled', await page.evaluate("document.fonts.check(\"16px 'Pixelify Sans'\")") and await page.evaluate("document.fonts.check(\"10px 'Silkscreen'\")"))
        check('no outside requests (no Google Fonts etc.)', not outside, sorted(outside)[:3])

        # ---- pull the plug ----
        server.terminate(); server.wait()
        await page.wait_for_timeout(300)
        await page.reload()
        await page.wait_for_timeout(1500)
        state = await page.evaluate("typeof S!=='undefined'&&S?[S.fish.length,S.coins]:null")
        check('opens with the server OFF', state is not None, state)
        check('your tank is still there', state == [3, 321], state)
        check('page title came from the saved copy', await page.title() == 'Finlings')
        # a different query string still hits the saved page
        await page.goto(BASE + '?utm=test')
        await page.wait_for_timeout(1000)
        check('opens with a query string offline', await page.evaluate("typeof S!=='undefined'&&!!S"))

        # ---- backup code through the real UI ----
        await page.click('#btnSettings')
        await page.wait_for_timeout(500)
        await page.click('[data-act=backup-copy]')
        await page.wait_for_timeout(400)
        code = await page.evaluate("document.querySelector('textarea.codebox[readonly]')?.value||''")
        check('backup code appears (compressed)', code.startswith('FIN1z:') and len(code) > 50, code[:12] + f'... ({len(code)} chars)')
        await page.evaluate("S.fish.length=0;S.coins=1;saveNow()")      # wreck the tank
        await page.click('[data-act=backup-restore-open]')
        await page.fill('#restoreBox', 'not a code')
        await page.click('[data-act=backup-restore-go]')
        await page.wait_for_timeout(300)
        check('junk code is rejected', 'not look like' in (await page.inner_text('#sheetPanel')) and await page.evaluate("S.fish.length") == 0)
        await page.fill('#restoreBox', '  ' + code[:60] + '\n' + code[60:] + ' ')   # whitespace/line breaks are fine
        await page.click('[data-act=backup-restore-go]')
        await page.wait_for_timeout(300)
        check('valid code asks to confirm first', 'Found a tank with 3' in (await page.inner_text('#sheetPanel')) and await page.evaluate("S.fish.length") == 0)
        await page.click('[data-act=backup-restore-go]')
        await page.wait_for_timeout(800)
        after = await page.evaluate("[S.fish.length,S.coins,S.fish.map(f=>f.sp).sort().join()]")
        check('restore brings the tank back', after[0] == 3 and after[1] == 321 and after[2] == 'guppy,moon,tetra', after)
        check('no script errors', not [e for e in errs if 'ERR_' not in e and 'Failed to load resource' not in e], errs[:3])
        await b.close()

        # ---- update flow: a new build replaces the old offline copy ----
        server = serve(site)
        b = await p.chromium.launch(**launch_options)
        ctx = await b.new_context()
        page = await ctx.new_page()
        await page.goto(BASE); await page.wait_for_timeout(1500)
        await page.evaluate("navigator.serviceWorker.ready")
        old = await page.evaluate("caches.keys()")
        sw = site / 'FishTankIdle' / 'sw.js'
        sw.write_text(sw.read_text().replace(old[0], 'finlings-NEWBUILD'))
        await page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
        for _ in range(30):
            now = await page.evaluate("caches.keys()")
            if now == ['finlings-NEWBUILD']: break
            await page.wait_for_timeout(200)
        check('a new build swaps in and old copy is deleted', now == ['finlings-NEWBUILD'], now)
        await b.close()
    server.terminate()
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if problems else 0)

asyncio.run(main())
