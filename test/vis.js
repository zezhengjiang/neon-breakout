const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
const SHOT = path.join(__dirname, 'shots3');
fs.mkdirSync(SHOT, { recursive: true });
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('.html') || p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(HTML); return; }
  res.writeHead(404); res.end('nf');
});
(async () => {
  await new Promise(r => server.listen(8934, r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8934/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT + '/v1-menu.png' });
  await page.click('#startBtn'); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + '/v2-loadout.png' });
  await page.click('#loStart'); await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT + '/v3-play-start.png' });
  await page.mouse.move(550, 310);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT + '/v4-ads-held.png' });
  await page.mouse.up({ button: 'right' });
  await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();
  await page.screenshot({ path: SHOT + '/v5-fire.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close(); server.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
