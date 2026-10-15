import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

export const VIEWPORTS = {
  desktop: { key: 'desktop', label: '1440', width: 1440, height: 900, mobile: false },
  mobile: { key: 'mobile', label: '375', width: 375, height: 812, mobile: true },
};

const inpageSource = await readFile(fileURLToPath(new URL('./inpage.js', import.meta.url)), 'utf8');

export async function launch({ channel = 'chrome', headed = false } = {}) {
  try {
    return await chromium.launch({ channel, headless: !headed });
  } catch (e) {
    throw new Error(
      `ブラウザ(channel: ${channel})を起動できません。Google Chrome がインストールされているか確認してください。\n${e.message}`,
    );
  }
}

export function newContext(browser, vp) {
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
  });
}

/**
 * 画面を開く。JS エラー、コンソールエラー、外部リクエストを集めて返す。
 * errors.* は開いた後の操作中のものも含めて、後から読める(参照を共有している)。
 */
export async function openPage(context, file) {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = { js: [], console: [], external: [] };
  page.on('pageerror', (e) => errors.js.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.console.push(m.text());
  });
  page.on('request', (r) => {
    if (!/^(file|data|blob|about):/.test(r.url())) errors.external.push(r.url());
  });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(inpageSource);
  await settle(page);
  return { page, errors };
}

export async function settle(page, ms = 150) {
  await page.evaluate((t) => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, t)))), ms);
}

export const inpage = (page, fn, arg) => page.evaluate(([name, a]) => window.__verify[name](a), [fn, arg]);
