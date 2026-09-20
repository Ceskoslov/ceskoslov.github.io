const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-browser-'));
  let browser;
  const root = path.join(__dirname, '..');
  const output = path.join(temporary, 'public');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let file = path.resolve(output, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(output + path.sep) && file !== output) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const name of ['templates', 'content', 'static']) fs.cpSync(path.join(root, name), path.join(temporary, name), { recursive: true });
    fs.copyFileSync(path.join(root, 'zola.toml'), path.join(temporary, 'zola.toml'));
    const table = [Array.from({ length: 16 }, (_, i) => 'Column ' + i), Array(16).fill('---'), Array(16).fill('Cell')]
      .map(row => '| ' + row.join(' | ') + ' |').join('\n');
    fs.writeFileSync(path.join(temporary, 'content/writing/browser-fixture.md'), `+++\ntitle = "Browser fixture"\ndate = 2026-09-21\n+++\n## One\nText.\n## Two\nText.\n## Three\n\n${table}\n`);
    execFileSync('zola', ['--root', temporary, 'build', '--base-url', base], { stdio: 'inherit' });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const errors = [];
    async function pageFor(options = {}, init) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options });
      context.setDefaultTimeout(10000);
      if (init) await context.addInitScript(init);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      return page;
    }
    console.log('Checking navigation and article reading…');
    const page = await pageFor();
    await page.goto(base);
    const selectedCards = page.locator('.post-feed--selected .post-card');
    const latestCards = page.locator('.post-feed:not(.post-feed--selected) .post-card');
    assert.equal(await selectedCards.count(), 2);
    assert.equal(await latestCards.count(), 6);
    for (const cards of [selectedCards, latestCards]) {
      assert.equal(await cards.first().locator('.post-card__meta time').count(), 1);
      assert.equal(await cards.first().locator('.language-badge').count(), 1);
    }
    const headingSizes = await page.locator('.section-heading h2 .atlas-reveal__inner').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).fontSize));
    assert.equal(headingSizes[0], headingSizes[1]);
    assert.ok(parseFloat(headingSizes[0]) >= 32);
    await page.locator('.menu-toggle').click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('.site-nav a'));
    assert.equal(await page.locator('main').evaluate(e => e.inert), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu-toggle').evaluate(e => e === document.activeElement), true);
    await page.locator('.menu-toggle').click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('.site-nav a'));
    await page.locator('.site-nav a').last().focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.menu-toggle').evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('.site-nav a').last().evaluate(e => e === document.activeElement), true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => !document.body.classList.contains('menu-open'));
    assert.equal(await page.locator('main').evaluate(e => e.inert), false);
    await page.goto(base + '/writing/browser-fixture/');
    assert.equal(await page.locator('.post-toc').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.table-scroll').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.table-scroll').scrollLeft > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.goto(base);
    await page.locator('.post-card .tag-list a').first().click();
    assert.match(page.url(), /\/tags\//);
    assert.equal(await page.title(), await page.locator('meta[property="og:title"]').getAttribute('content'));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), page.url());
    const share = await page.locator('meta[property="og:image"]').getAttribute('content');
    assert.equal((await page.request.get(share)).status(), 200);
    await page.locator('.quiet-toggle').click();
    assert.equal(await page.locator('.quiet-toggle').getAttribute('aria-pressed'), 'true');
    await page.reload();
    assert.equal(await page.locator('.page-atlas-background').isVisible(), false);
    assert.equal(await page.locator('canvas[data-atlas-renderer]').count(), 0);
    await page.locator('.quiet-toggle').click();
    await page.waitForSelector('canvas[data-atlas-renderer]');
    await page.locator('.theme-toggle').click();
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');

    console.log('Checking no-JS and storage fallback…');
    const nojs = await pageFor({ javaScriptEnabled: false });
    await nojs.goto(base);
    assert.equal(await nojs.locator('.site-nav').isVisible(), true);
    assert.equal(await nojs.locator('.menu-toggle').isVisible(), false);
    const blocked = await pageFor({}, () => {
      Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
    });
    await blocked.goto(base);
    await blocked.locator('.theme-toggle').click();
    assert.equal(await blocked.locator('html').getAttribute('data-theme'), 'dark');

    console.log('Checking renderer fallback and recovery…');
    const fallback = await pageFor({ deviceScaleFactor: 3, reducedMotion: 'no-preference' }, () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind.includes('webgl') ? null : original.call(this, kind, ...args);
      };
      window.cpuPaints = 0;
      const paint = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (...args) { window.cpuPaints++; return paint.apply(this, args); };
    });
    await fallback.goto(base);
    await fallback.waitForSelector('[data-atlas-renderer="static"]');
    assert.equal(await fallback.locator('canvas').evaluateAll(nodes => nodes.every(c => c.width * c.height <= 181000)), true);
    const paints = await fallback.evaluate(() => window.cpuPaints);
    await fallback.mouse.move(100, 200); await fallback.mouse.move(200, 400);
    await fallback.evaluate(() => scrollTo(0, 600));
    await fallback.waitForTimeout(250);
    assert.equal(await fallback.evaluate(() => window.cpuPaints), paints);
    const shaderFailure = await pageFor({}, () => { WebGLRenderingContext.prototype.getShaderParameter = () => false; });
    await shaderFailure.goto(base);
    await shaderFailure.waitForSelector('[data-atlas-renderer="static"]');
    assert.equal(await shaderFailure.locator('canvas').count(), 2);

    const gpu = await pageFor({ deviceScaleFactor: 3, reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
    await gpu.goto(base);
    await gpu.waitForSelector('[data-atlas-renderer]');
    assert.equal(await gpu.locator('canvas').evaluateAll(nodes => nodes.every(c => c.width * c.height <= 2003000)), true);
    const canLoseContext = await gpu.evaluate(() => {
      const canvas = document.querySelector('[data-atlas-background]');
      if (canvas.dataset.atlasRenderer !== 'webgl') return false;
      window.loseContext = canvas.getContext('webgl').getExtension('WEBGL_lose_context');
      if (!window.loseContext) return false;
      window.loseContext.loseContext(); return true;
    });
    assert.equal(canLoseContext, true, 'Browser must support WebGL context-loss testing');
    await gpu.waitForFunction(() => document.querySelector('[data-atlas-background]').style.visibility === 'hidden');
    await gpu.evaluate(() => window.loseContext.restoreContext());
    await gpu.waitForFunction(() => document.querySelector('[data-atlas-background]').style.visibility !== 'hidden');
    assert.deepEqual(errors, []);
    console.log('PASS: keyboard/menu/no-JS, responsive tables, sharing, quiet/theme/storage, static fallback, shader failure, DPR budget, WebGL recovery');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
