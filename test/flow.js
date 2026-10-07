const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/pw/node_modules/playwright-core');

const ROOT = __dirname;
const SHOT = __dirname + '/shots2';
fs.mkdirSync(SHOT, { recursive: true });
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/hooked.html';
  if (p === '/index.html') p = '/hooked.html';
  if (p.endsWith('.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(HTML); return; }
  res.writeHead(404); res.end('nf');
});
function readRetry(fp, n) {   // 沙箱共享 fs 偶发 ENOENT,重试规避
  for (let i = 0; i < (n || 30); i++) {
    try { return fs.readFileSync(fp); } catch (e) {
      const { execSync } = require('child_process');
      try { execSync('sync'); } catch (e2) {}
      require('child_process').spawnSync('sleep', ['0.3']);
    }
  }
  throw new Error('unreadable ' + fp);
}
const HTML = readRetry(path.join(ROOT, 'hooked.html'));
let fails = 0;
const check = (name, cond, extra) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''}`); if (!cond) fails++; };

(async () => {
  await new Promise(r => server.listen(8932, r));
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('console: ' + m.text()); });

  await page.goto('http://localhost:8932/hooked.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.click('#startBtn'); await page.waitForTimeout(400);
  await page.click('#loStart'); await page.waitForTimeout(2200);

  const g = () => page.evaluate(() => ({ st: window.__g.state, pitch: window.__g.pitch, yaw: window.__g.yaw, ph: window.__g.wavePhase, ammo: window.__g.ammo, n: window.__g.enemies.length, qf: window.__g.qFocus, pos: window.__g.pos }));

  await page.setViewportSize({ width: 480, height: 300 });   // 小窗口提高软渲染 fps
  await page.waitForTimeout(400);
  let s = await g();
  check('enter playing', s.st === 'playing', s.st);
  check('view not warped by lock jump (pitch~0)', Math.abs(s.pitch) < 0.35, s.pitch);
  check('view not warped by lock jump (yaw~0)', Math.abs(s.yaw) < 0.35, s.yaw);
  await page.screenshot({ path: SHOT + '/f1-start.png' });

  // auto fire
  await page.mouse.move(240, 150);
  await page.mouse.down(); await page.waitForTimeout(4000); await page.mouse.up();
  s = await g();
  check('auto fire consumed ammo', s.ammo < 27, s.ammo);

  // clear wave -> intermission
  await page.evaluate(() => {
    window.__k = setInterval(() => {
      if (window.__g.wavePhase === 'inter') { clearInterval(window.__k); return; }
      window.__g.heal(); window.__g.killAll();
    }, 350);
  });
  await page.waitForFunction(() => window.__g.wavePhase === 'inter', { timeout: 60000, polling: 400 }).catch(() => {});
  await page.evaluate(() => clearInterval(window.__k));
  await page.waitForTimeout(400);
  s = await g();
  check('intermission reached', s.ph === 'inter', s.ph);
  check('inter panel visible', await page.evaluate(() => !document.getElementById('interOv').classList.contains('hidden')));
  await page.screenshot({ path: SHOT + '/f2-inter.png' });

  // quick bench
  await page.keyboard.press('KeyB'); await page.waitForTimeout(400);
  check('quick open', await page.evaluate(() => !document.getElementById('quickOv').classList.contains('hidden')));
  for (let i = 0; i < 10; i++) await page.keyboard.press('KeyS');
  s = await g();
  check('qFocus clamps at knife row (7)', s.qf === 7, s.qf);
  await page.keyboard.press('KeyW'); await page.waitForTimeout(200);   // grip row (6)
  await page.keyboard.press('KeyD'); await page.waitForTimeout(300);   // cycle grip
  await page.screenshot({ path: SHOT + '/f3-quick.png' });
  await page.keyboard.press('KeyB'); await page.waitForTimeout(300);
  check('quick closed -> inter back', await page.evaluate(() => !document.getElementById('interOv').classList.contains('hidden')));

  // next wave
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('waveNum').textContent === '2', { timeout: 20000, polling: 400 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.waitForFunction(() => window.__g.enemies.length > 0, { timeout: 20000, polling: 400 }).catch(() => {});
  s = await g();
  check('wave 2 spawning', s.ph === 'spawning' && s.n > 0, s);
  check('hud wave=2', (await page.evaluate(() => document.getElementById('waveNum').textContent)) === '2');

  // game over
  await page.evaluate(() => window.__g.hurtMe(9999));
  await page.waitForTimeout(900);
  s = await g();
  check('game over state', s.st === 'over', s.st);
  check('over overlay', await page.evaluate(() => !document.getElementById('overOv').classList.contains('hidden')));
  await page.screenshot({ path: SHOT + '/f4-over.png' });

  // change loadout: no leftover enemies
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.waitForTimeout(300);
  await page.click('#changeLoadoutBtn'); await page.waitForTimeout(600);
  s = await g();
  check('loadout clean of corpses', s.n === 0, s.n);
  await page.screenshot({ path: SHOT + '/f5-loadout.png' });

  // re-deploy: lock again, view stays level
  await page.click('#loStart'); await page.waitForTimeout(2200);
  s = await g();
  check('redeploy playing', s.st === 'playing', s.st);
  check('redeploy view level', Math.abs(s.pitch) < 0.35 && Math.abs(s.yaw) < 0.35, [s.pitch, s.yaw]);
  await page.screenshot({ path: SHOT + '/f6-redeploy.png' });

  // pause / resume
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(700);
  check('pause overlay', await page.evaluate(() => !document.getElementById('pauseOv').classList.contains('hidden')));
  await page.click('#resumeBtn'); await page.waitForTimeout(1200);
  s = await g();
  check('resumed playing', s.st === 'playing', s.st);

  check('no page errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
  await browser.close(); server.close();
  process.exit(0);
})().catch(e => { console.error('HARNESS ERROR', e.message); process.exit(1); });
