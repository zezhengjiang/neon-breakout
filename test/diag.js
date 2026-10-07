const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/pw/node_modules/playwright-core');

const ROOT = process.argv[2] || '/home/user/uploads';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
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
  const L = s => { logs.push(s); console.log(s); };
  page.on('console', m => L(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message} @ ${(e.stack||'').split('\n')[1]||''}`));
  page.on('requestfailed', r => L(`[REQFAIL] ${r.url()}`));

  await page.goto('http://localhost:8931/index.html', { waitUntil: 'load', timeout: 60000 });
  // instrument: count mouse events at window + rAF fps
  await page.evaluate(() => {
    window.__ev = { down: 0, up: 0, move: 0, raf: 0, lastMoves: [] };
    addEventListener('mousedown', e => window.__ev.down++, true);
    addEventListener('mouseup', e => window.__ev.up++, true);
    addEventListener('mousemove', e => { window.__ev.move++; if (window.__ev.lastMoves.length < 40) window.__ev.lastMoves.push([e.movementX, e.movementY, e.buttons]); }, true);
    const loop = () => { window.__ev.raf++; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  await page.waitForTimeout(1500);
  await page.click('#startBtn'); await page.waitForTimeout(500);
  await page.click('#loStart'); await page.waitForTimeout(2000);
  L('locked=' + await page.evaluate(() => !!document.pointerLockElement));
  L('firstMoves=' + JSON.stringify(await page.evaluate(() => window.__ev.lastMoves.slice(0, 6))));

  const ammo = () => page.evaluate(() => document.getElementById('ammoNum').textContent);
  const raf0 = await page.evaluate(() => window.__ev.raf);
  const t0 = Date.now();

  await page.mouse.move(640, 400);
  await page.mouse.down();
  const samples = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); samples.push(await ammo()); }
  await page.mouse.up();
  const raf1 = await page.evaluate(() => window.__ev.raf);
  L(`hold 1.8s ammo samples: ${samples.join(',')} | fps≈${((raf1 - raf0) / ((Date.now() - t0) / 1000)).toFixed(1)}`);
  L('events=' + JSON.stringify(await page.evaluate(() => ({ down: window.__ev.down, up: window.__ev.up, move: window.__ev.move }))));

  // right-button ADS test: sample scope overlay visibility WHILE held
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(900);
  L('ads while held: rdsHidden=' + await page.evaluate(() => document.getElementById('rdsOv').classList.contains('hidden')) +
    ' scopeHidden=' + await page.evaluate(() => document.getElementById('scopeOv').classList.contains('hidden')) +
    ' fov=' + await page.evaluate(() => document.querySelector('canvas') && 'n/a'));
  await page.screenshot({ path: '/home/user/test/shots/d-ads-held.png' });
  await page.mouse.up({ button: 'right' });

  // wave clear / intermission sanity: force time? just observe enemies count over 12s
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); }
  L('after idle: ' + JSON.stringify(await page.evaluate(() => ({
    wave: document.getElementById('waveNum').textContent,
    enemies: document.getElementById('enemyNum').textContent,
    hp: document.getElementById('hpNum').textContent,
    toast: document.getElementById('toast').textContent,
    inter: !document.getElementById('interOv').classList.contains('hidden'),
  }))));
  await browser.close(); server.close();
})().catch(e => { console.error('HARNESS ERROR', e.message); process.exit(1); });
