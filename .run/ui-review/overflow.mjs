import pw from '../../apps/eval-hub/node_modules/@playwright/test/index.js';
const { chromium } = pw;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' }).catch(async () => {
  await browser.close(); process.exit(2);
});
await page.waitForLoadState('networkidle');
const data = await page.evaluate(() => [...document.querySelectorAll('body *')].map((el) => {
  const r = el.getBoundingClientRect();
  return { tag: el.tagName.toLowerCase(), id: el.id, cls: String(el.className || '').slice(0,80), text: (el.textContent||'').trim().replace(/\s+/g,' ').slice(0,70), x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right), scrollW: el.scrollWidth, clientW: el.clientWidth };
}).filter(x => x.right > document.documentElement.clientWidth + 1 || x.x < -1 || x.scrollW > x.clientW + 1).slice(0,50));
console.log(JSON.stringify({clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), data}, null, 2));
await browser.close();
