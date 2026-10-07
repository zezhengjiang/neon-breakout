const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/pw/node_modules/playwright-core');

const ROOT = process.argv[2] || '/home/user/uploads';
const SHOT = process.argv[3] || '/home/user/test/shots';
const MODE = process.argv[4] || 'quick';
fs.mkdirSync(SHOT, { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(f);
    const ct = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(8931, r));
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', m => { logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => { logs.push(`[PAGEERROR] ${e.message}\n${(e.stack||'').split('\n').slice(0,4).join('\n')}`); });
  page.on('requestfailed', r => { logs.push(`[REQFAIL] ${r.url()} :: ${r.failure() && r.failure().errorText}`); });

  await page.goto('http://localhost:8931/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  const dump = async (tag) => {
    const st = await page.evaluate(() => ({
      three: !!window.THREE,
      menuHidden: document.getElementById('menu').classList.contains('hidden'),
      loadoutHidden: document.getElementById('loadoutOv').classList.contains('hidden'),
      hudHidden: document.getElementById('hud').classList.contains('hidden'),
      pauseHidden: document.getElementById('pauseOv').classList.contains('hidden'),
      overHidden: document.getElementById('overOv').classList.contains('hidden'),
      interHidden: document.getElementById('interOv').classList.contains('hidden'),
      quickHidden: document.getElementById('quickOv').classList.contains('hidden'),
      ptrLock: !!document.pointerLockElement,
      toast: document.getElementById('toast').textContent,
      wave: document.getElementById('waveNum').textContent,
      score: document.getElementById('scoreNum').textContent,
      hp: document.getElementById('hpNum').textContent,
      ammo: document.getElementById('ammoNum').textContent,
      enemies: document.getElementById('enemyNum').textContent,
      canvasW: document.querySelector('canvas') ? document.querySelector('canvas').width : 0,
    }));
    logs.push(`STATE(${tag}): ${JSON.stringify(st)}`);
    await page.screenshot({ path: path.join(SHOT, tag + '.png') });
    return st;
  };

  await dump('01-menu');

  // click start -> loadout
  await page.click('#startBtn');
  await page.waitForTimeout(600);
  await dump('02-loadout');

  // click loStart -> pointer lock -> startRun
  await page.click('#loStart');
  await page.waitForTimeout(2500);
  const s3 = await dump('03-playing');

  if (s3.ptrLock) {
    // simulate gameplay: move mouse, hold fire, move around
    await page.mouse.move(640, 400);
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(640 + i * 8, 400 + (i % 3) * 4);
      await page.waitForTimeout(30);
    }
    await page.keyboard.down('KeyW');
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await page.keyboard.up('KeyW');
    await dump('04-fired');

    // reload + knife switch + ADS
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(400);
    await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
    await page.keyboard.press('Digit1');
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(700);
    await page.mouse.up({ button: 'right' });
    await dump('05-ads');

    // ESC -> pause
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await dump('06-pause');
    await page.click('#resumeBtn');
    await page.waitForTimeout(1200);
    await dump('07-resumed');
  }

  if (MODE === 'long') {
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(640 + Math.sin(i) * 200, 400 + Math.cos(i) * 80);
      await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
      await page.waitForTimeout(650);
    }
    await dump('08-combat');
  }

  console.log(logs.join('\n'));
  await browser.close();
  server.close();
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
