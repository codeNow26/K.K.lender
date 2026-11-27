import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const url = 'https://kklender.philipp-nowotnick.de/preview/calendar-upgrades/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  for (const { name, viewport, fast } of [
    { name: 'desktop', viewport: { width: 1366, height: 768 }, fast: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, fast: true },
  ]) {
    const page = await browser.newPage({ viewport, isMobile: fast, hasTouch: fast });
    page.on('pageerror', error => console.error(name, error.message));
    if (fast) await page.clock.install();
    await page.goto(url + '?v=' + process.env.GITHUB_SHA + (fast ? '&gift=1' : ''), { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Inselpläne' }).waitFor({ timeout: 15000 });
    const monthLabel = page.locator('.month-navigation h3');
    const before = await monthLabel.textContent();
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
    await page.waitForFunction(previous => document.querySelector('.month-navigation h3')?.textContent !== previous, before);
    await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
    await page.waitForFunction(previous => document.querySelector('.month-navigation h3')?.textContent === previous, before);
    const balloon = page.getByRole('button', { name: 'Fliegendes Inselgeschenk fangen' });
    const openEditor = () => page.getByRole('button', { name: 'Inselereignis', exact: true }).click();
    const saveEditor = async () => {
      await page.getByRole('button', { name: 'Inselereignis speichern' }).click();
      await page.getByText('Dein Termin wurde gespeichert. 🌿', { exact: true }).waitFor();
      await page.locator('#event-title').waitFor({ state: 'detached' });
    };
    const visibleGift = async () => {
      await balloon.waitFor({ state: 'visible', timeout: fast ? 15000 : 40000 });
      await page.waitForFunction(() => {
        const el = document.querySelector('app-balloon-gift button.balloon');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && el.contains(document.elementFromPoint(x, y));
      }, undefined, { timeout: 12000 });
      const info = await balloon.evaluate(el => {
        const svg = el.querySelector('svg');
        const r = svg.getBoundingClientRect();
        return { width: r.width, height: r.height, x: r.x, y: r.y, visible: getComputedStyle(svg).visibility };
      });
      assert.ok(info.width > 40 && info.height > 60 && info.visible === 'visible', JSON.stringify(info));
    };
    await openEditor();
    await page.locator('#event-title').fill('Browser-Test Inselereignis');
    await visibleGift();
    assert.ok(await page.locator('#event-title').isVisible(), 'Gift should appear while editor is open');
    await page.screenshot({ path: 'balloon-' + name + '-during-editor.png' });
    const originalGift = await balloon.elementHandle();
    await saveEditor();
    await visibleGift();
    assert.ok(await originalGift.evaluate(el => el.isConnected), 'Saving must not destroy the flying gift');
    await page.screenshot({ path: 'balloon-' + name + '-after-save.png' });
    await balloon.click({ force: true, timeout: 5000 });
    await page.getByText('Inselgeschenk gefangen!', { exact: true }).waitFor({ timeout: 3000 });
    console.log(name + ': gift appeared during editing, survived saving and was caught');
    if (fast) {
      await openEditor();
      await page.locator('#event-title').fill('Zweiter Geschenk-Test');
      await page.clock.fastForward(121000);
      await visibleGift();
      await saveEditor();
      await visibleGift();
      await balloon.click({ force: true, timeout: 5000 });
      await page.getByText('Inselgeschenk gefangen!', { exact: true }).waitFor({ timeout: 3000 });
      console.log(name + ': next gift also appeared and survived another save');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
