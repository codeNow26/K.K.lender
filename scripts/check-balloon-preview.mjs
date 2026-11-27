import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const url = 'https://kklender.philipp-nowotnick.de/preview/calendar-upgrades/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const cases = [
    { name: 'desktop', viewport: { width: 1366, height: 768 }, fast: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, fast: true },
  ];
  for (const { name, viewport, fast } of cases) {
    const page = await browser.newPage({ viewport, isMobile: fast, hasTouch: fast });
    page.on('pageerror', error => console.error(name, error.message));
    if (fast) await page.clock.install();
    await page.goto(url + '?v=' + process.env.GITHUB_SHA + (fast ? '&gift=1' : ''), { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Inselpläne' }).waitFor({ timeout: 15000 });
    const balloon = page.getByRole('button', { name: 'Fliegendes Inselgeschenk fangen' });
    // Reproduce opening the form before a gift is due and saving after its deadline.
    if (!fast) {
      await page.getByRole('button', { name: 'Inselereignis', exact: true }).click();
      await page.locator('#event-title').fill('Browser-Test Inselereignis');
      await page.waitForTimeout(31000);
      assert.equal(await balloon.count(), 0, 'Gift should not interrupt the editor');
      await page.getByRole('button', { name: 'Inselereignis speichern' }).click();
      await page.getByText('Dein Termin wurde gespeichert. 🌿', { exact: true }).waitFor();
      await page.locator('#event-title').waitFor({ state: 'detached' });
      console.log(name + ': saved a new event after the gift deadline');
    }
    await balloon.waitFor({ state: 'visible', timeout: fast ? 12000 : 40000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('app-balloon-gift button.balloon');
      if (!button) return false;
      const r = button.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return false;
      return button.contains(document.elementFromPoint(x, y));
    }, undefined, { timeout: 12000 });
    const info = await balloon.evaluate(el => {
      const svg = el.querySelector('svg');
      const r = svg.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, y: r.y, visible: getComputedStyle(svg).visibility };
    });
    assert.ok(info.width > 40 && info.height > 60 && info.visible === 'visible', JSON.stringify(info));
    await page.screenshot({ path: 'balloon-' + name + '.png' });
    // The target moves continuously, so click its current center rather than wait for layout stability.
    await balloon.click({ force: true, timeout: 5000 });
    await page.getByText('Inselgeschenk gefangen!', { exact: true }).waitFor({ timeout: 3000 });
    console.log(name + ': visible balloon and successful catch', info);
    if (fast) {
      await page.getByRole('button', { name: 'Inselereignis', exact: true }).click();
      await page.locator('#event-title').fill('Zweiter Geschenk-Test');
      await page.clock.fastForward(121000);
      assert.equal(await balloon.count(), 0, 'Second gift should wait for the editor');
      await page.getByRole('button', { name: 'Inselereignis speichern' }).click();
      await page.getByText('Dein Termin wurde gespeichert. 🌿', { exact: true }).waitFor();
      await page.locator('#event-title').waitFor({ state: 'detached' });
      await balloon.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForFunction(() => {
        const el = document.querySelector('app-balloon-gift button.balloon');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }, undefined, { timeout: 10000 });
      await page.screenshot({ path: 'balloon-mobile-after-save.png' });
      await balloon.click({ force: true, timeout: 5000 });
      await page.getByText('Inselgeschenk gefangen!', { exact: true }).waitFor({ timeout: 3000 });
      console.log(name + ': second gift successfully caught after saving an event');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
