import pw from '../../apps/eval-hub/node_modules/@playwright/test/index.js';
const { chromium } = pw;

const baseURL = process.env.BASE_URL;
const browser = await chromium.launch({ headless: true });
const results = { baseURL, viewports: [], console: [], pageErrors: [], keyboard: [], reverseKeyboard: [], a11y: {}, perf: {}, styles: {}, screenshots: [] };

function luminance(rgb) {
  const a = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function parseRgb(s) {
  const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function contrastRatio(fg, bg) {
  const f = parseRgb(fg), b = parseRgb(bg);
  if (!f || !b) return null;
  const l1 = luminance(f), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
async function testViewport(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) results.console.push({ type: msg.type(), text: msg.text(), location: msg.location() }); });
  page.on('pageerror', err => results.pageErrors.push(String(err.message || err)));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.locator('main').waitFor({ state: 'visible' });
  const shot = '.run/ui-review/' + label + '.png';
  await page.screenshot({ path: shot, fullPage: true });
  results.screenshots.push({ label, path: shot, width, height });
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint').map(p => ({ name: p.name, startTime: Math.round(p.startTime) }));
    const body = document.body.getBoundingClientRect();
    return {
      title: document.title,
      url: location.href,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyHeight: Math.round(body.height),
      nav: nav ? { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), loadEventEnd: Math.round(nav.loadEventEnd), transferSize: nav.transferSize, encodedBodySize: nav.encodedBodySize } : null,
      paints
    };
  });
  const a11y = await page.evaluate(() => {
    const text = el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    const accName = el => el.getAttribute('aria-label') || el.getAttribute('title') || text(el) || el.getAttribute('alt') || '';
    return {
      headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 30).map(h => ({ level: h.tagName, text: text(h) })),
      landmarks: [...document.querySelectorAll('header,nav,main,aside,footer')].map(el => ({ tag: el.tagName.toLowerCase(), label: el.getAttribute('aria-label') || '', id: el.id || '', classes: el.className || '' })),
      links: [...document.querySelectorAll('a')].map(a => ({ text: text(a), href: a.getAttribute('href'), name: accName(a) })).filter(x => !x.name || /^https?:\/\//.test(x.name) || /click here/i.test(x.name)).slice(0, 20),
      images: [...document.images].map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') })).filter(img => img.alt === null || img.alt === '').slice(0, 20),
      forms: [...document.querySelectorAll('input,select,textarea')].map(el => ({ tag: el.tagName, type: el.getAttribute('type'), label: el.labels?.[0]?.innerText || el.getAttribute('aria-label') || '' })).filter(x => !x.label),
      buttons: [...document.querySelectorAll('button')].map(b => ({ text: text(b), aria: b.getAttribute('aria-label') || '' })).filter(x => !(x.text || x.aria)),
      skipLinks: [...document.querySelectorAll('a[href^="#"]')].filter(a => /skip/i.test(text(a))).map(a => ({ text: text(a), href: a.getAttribute('href') }))
    };
  });
  const styleSamples = await page.evaluate(() => {
    function info(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { selector: sel, color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize, lineHeight: cs.lineHeight, outline: cs.outline, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius };
    }
    return ['body', 'header', '.hero', '.card', '.sidebar a', 'main a', 'button', '.search-input'].map(info).filter(Boolean);
  });
  results.viewports.push({ label, width, height, metrics, a11y, styleSamples });
  await page.close();
}

await testViewport(1440, 1000, 'desktop');
await testViewport(390, 844, 'mobile');

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', msg => { if (['error','warning'].includes(msg.type())) results.console.push({ type: msg.type(), text: msg.text(), location: msg.location() }); });
await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle');
await page.keyboard.press('Home');
for (let i = 0; i < 18; i++) {
  await page.keyboard.press('Tab');
  const f = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 90);
    return { tag: el.tagName.toLowerCase(), text: txt, id: el.id, classes: String(el.className || '').slice(0,80), href: el.getAttribute('href'), outline: cs.outline, boxShadow: cs.boxShadow, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  results.keyboard.push(f);
}
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Shift+Tab');
  const f = await page.evaluate(() => {
    const el = document.activeElement; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 90);
    return { tag: el.tagName.toLowerCase(), text: txt, href: el.getAttribute('href'), outline: cs.outline, boxShadow: cs.boxShadow, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  results.reverseKeyboard.push(f);
}
await page.screenshot({ path: '.run/ui-review/focus-after-tabs.png', fullPage: false });
results.screenshots.push({ label: 'focus-after-tabs', path: '.run/ui-review/focus-after-tabs.png', width: 1280, height: 900 });

results.contrast = await page.evaluate(() => {
  function bgOf(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
  return ['body', 'h1', 'h2', '.hero p', '.card p', '.sidebar a', '.sidebar a.active', 'main a', 'code'].map(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { selector: sel, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0,80), color: cs.color, backgroundColor: bgOf(el), fontSize: cs.fontSize, fontWeight: cs.fontWeight };
  }).filter(Boolean);
});
results.contrast = results.contrast.map(x => ({...x, ratio: contrastRatio(x.color, x.backgroundColor)}));

results.perf = await page.evaluate(() => ({
  resources: performance.getEntriesByType('resource').map(r => ({ name: r.name.split('/').slice(-1)[0], initiatorType: r.initiatorType, transferSize: r.transferSize, duration: Math.round(r.duration) })).slice(0,50),
  navigation: performance.getEntriesByType('navigation')[0] ? { duration: Math.round(performance.getEntriesByType('navigation')[0].duration), domInteractive: Math.round(performance.getEntriesByType('navigation')[0].domInteractive) } : null,
  paints: performance.getEntriesByType('paint').map(p => ({ name: p.name, startTime: Math.round(p.startTime) }))
}));

await browser.close();
console.log(JSON.stringify(results, null, 2));
