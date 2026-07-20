import pkg from '../../apps/eval-hub/node_modules/@playwright/test/index.js';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const { chromium } = pkg;

const outDir = '.run/docs-index-check';
mkdirSync(outDir, { recursive: true });

async function urlLooksRight(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    return res.ok && text.includes('<title>') && (text.includes('Agentic') || text.includes('Harness') || text.includes('Documentation'));
  } catch { return false; }
}

let baseURL = 'http://127.0.0.1:8765';
let server = null;
let startCommand = 'existing server on http://127.0.0.1:8765';
let stopCommand = 'none — reused pre-existing server';
if (!(await urlLooksRight(baseURL + '/'))) {
  baseURL = 'http://127.0.0.1:8766';
  startCommand = 'python3 -m http.server 8766 --bind 127.0.0.1 --directory dist/docs/html';
  server = spawn('python3', ['-m', 'http.server', '8766', '--bind', '127.0.0.1', '--directory', 'dist/docs/html'], { stdio: ['ignore', 'pipe', 'pipe'] });
  stopCommand = 'kill ' + server.pid;
  const deadline = Date.now() + 10000;
  while (!(await urlLooksRight(baseURL + '/'))) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for docs server readiness');
    await delay(100);
  }
}

const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium-browser' });
const results = { startCommand, baseURL, stopCommand, viewports: [], tabOrder: [], errors: [] };
try {
  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 }
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', msg => { if (['error','warning'].includes(msg.type())) consoleErrors.push(msg.type() + ': ' + msg.text()); });
    page.on('requestfailed', req => failedRequests.push(req.method() + ' ' + req.url() + ' ' + (req.failure()?.errorText || '')));
    const response = await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('body');
    const screenshot = outDir + '/' + vp.name + '-' + vp.width + 'x' + vp.height + '.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    const metrics = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const main = document.querySelector('main');
      const nav = document.querySelector('nav');
      const links = [...document.querySelectorAll('a')].map(a => ({ text: (a.textContent || '').trim().replace(/\s+/g,' ').slice(0,80), href: a.getAttribute('href'), rect: (() => { const r=a.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })() }));
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const title = document.title;
      const overflowX = Math.max(body.scrollWidth, html.scrollWidth) - html.clientWidth;
      const visibleText = (body.innerText || '').trim().length;
      const badLinks = links.filter(l => !l.text || /^click here$/i.test(l.text) || /^https?:\/\//.test(l.text));
      const zeroAreaLinks = links.filter(l => l.rect.w === 0 || l.rect.h === 0);
      return {
        title, h1, visibleText, linkCount: links.length,
        firstLinks: links.slice(0,12).map(l => ({text:l.text, href:l.href})),
        hasMain: !!main, hasNav: !!nav,
        viewportWidth: html.clientWidth, scrollWidth: Math.max(body.scrollWidth, html.scrollWidth), overflowX,
        bodyHeight: Math.max(body.scrollHeight, html.scrollHeight),
        badLinks, zeroAreaLinksCount: zeroAreaLinks.length
      };
    });
    results.viewports.push({ ...vp, status: response?.status(), url: page.url(), screenshot, consoleErrors, failedRequests, metrics });

    if (vp.name === 'desktop') {
      for (let i=0; i<12; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g,' ').slice(0,80),
            href: el.getAttribute('href'),
            visible: r.width > 0 && r.height > 0,
            outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
            boxShadow: cs.boxShadow
          };
        });
        results.tabOrder.push(focus);
      }
      await page.keyboard.press('Shift+Tab');
      results.reverseTab = await page.evaluate(() => {
        const el = document.activeElement;
        return { tag: el?.tagName.toLowerCase(), text: (el?.textContent || el?.getAttribute('aria-label') || '').trim().replace(/\s+/g,' ').slice(0,80), href: el?.getAttribute('href') };
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
writeFileSync(outDir + '/results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
