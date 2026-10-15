#!/usr/bin/env node
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch, newContext, openPage, inpage, settle, VIEWPORTS } from './lib/browser.mjs';
import { discoverPages } from './lib/pages.mjs';
import { CHECKS, Recorder } from './lib/functional.mjs';
import { buildMarkdown, exitCode, layoutStatus } from './lib/report.mjs';

const HELP = `使い方: node verify.mjs <実験フォルダ> [オプション]

  例: node verify.mjs ../../experiments/dashboard-001 --out /tmp/verify-out

  --out <dir>      結果(verify-result.json/.md)とスクリーンショットの出力先。
                   省略すると <実験フォルダ>/ と <実験フォルダ>/screenshots/ に書く
  --shots <dir>    スクリーンショットだけ別の場所に出す
  --rev <r1|r2>    修正後の実行。ファイル名の末尾に -r1 などを付ける
  --pages <a,b>    対象の画面を絞る(baseline,variant-a など)
  --only <list>    shots,layout,antipatterns,functional のうち実行するもの(カンマ区切り)
  --config <file>  設定ファイル(省略時は <実験フォルダ>/verify.config.json。なくてもよい)
  --channel <name> ブラウザ。既定 chrome(インストール済みの Google Chrome)
  --headed         ブラウザを表示する
  --strict         AI典型が上限を超えたら終了コード 1 にする
`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    shots: { type: 'string' },
    rev: { type: 'string' },
    pages: { type: 'string' },
    only: { type: 'string' },
    config: { type: 'string' },
    channel: { type: 'string', default: 'chrome' },
    headed: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opt.help || positionals.length !== 1) {
  console.log(HELP);
  process.exit(opt.help ? 0 : 2);
}

const expDir = path.resolve(positionals[0]);
const experiment = path.basename(expDir);
const rev = opt.rev ? `-${opt.rev.replace(/^-/, '')}` : '';
const resultDir = path.resolve(opt.out ?? expDir);
const shotsDir = path.resolve(opt.shots ?? (opt.out ? path.join(opt.out, 'screenshots') : path.join(expDir, 'screenshots')));
const phases = new Set((opt.only ?? 'shots,layout,antipatterns,functional').split(','));
const toolVersion = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')).version;

const configPath = path.resolve(opt.config ?? path.join(expDir, 'verify.config.json'));
const config = await stat(configPath).then(
  async () => JSON.parse(await readFile(configPath, 'utf8')),
  () => null,
);
if (!config && phases.has('functional')) console.error(`(設定ファイルがないため、機能要件の確認は省略: ${configPath})`);

let pages = await discoverPages(expDir, config);
if (opt.pages) pages = pages.filter((p) => opt.pages.split(',').includes(p.name));
if (!pages.length) {
  console.error(`画面案が見つかりません: ${expDir}(baseline/index.html、rules/*.html)`);
  process.exit(2);
}

await mkdir(shotsDir, { recursive: true });
await mkdir(resultDir, { recursive: true });

const browser = await launch({ channel: opt.channel, headed: opt.headed });
const contexts = Object.fromEntries(await Promise.all(Object.values(VIEWPORTS).map(async (vp) => [vp.key, await newContext(browser, vp)])));
const shotFile = (page, vp, suffix) => path.join(shotsDir, `${page}-${vp.label}${suffix ? `-${suffix}` : ''}${rev}.png`);

const result = {
  meta: {
    experiment,
    rev: opt.rev ?? null,
    generatedAt: new Date().toISOString(),
    browser: `${opt.channel} ${browser.version()}`,
    toolVersion,
    viewports: Object.values(VIEWPORTS).map((v) => `${v.width}×${v.height}${v.mobile ? '(mobile)' : ''}`),
    screenshotsDir: shotsDir,
    config: config ? configPath : null,
  },
  pages: [],
};

for (const pg of pages) {
  const entry = { name: pg.name, file: pg.file, viewports: [], functional: [] };
  result.pages.push(entry);

  // 1〜3: スクリーンショット、レイアウト、AI典型(画面×ビューポート)
  if (['shots', 'layout', 'antipatterns'].some((p) => phases.has(p))) {
    for (const vp of Object.values(VIEWPORTS)) {
      const { page, errors } = await openPage(contexts[vp.key], pg.file);
      const v = { viewport: vp.label, screenshots: [] };
      if (phases.has('layout')) v.layout = await inpage(page, 'layout', { refWidth: vp.width });
      if (phases.has('antipatterns')) v.antiPatterns = await inpage(page, 'antiPatterns');
      if (phases.has('shots')) {
        for (const [suffix, fullPage] of [['', false], ['full', true]]) {
          const file = shotFile(pg.name, vp, suffix);
          await page.screenshot({ path: file, fullPage, animations: 'disabled' });
          v.screenshots.push(file);
        }
      }
      if (v.layout) {
        v.layout.errors = errors;
        v.layout.status = layoutStatus(v.layout);
      }
      entry.viewports.push(v);
      await page.close();
    }
  }

  // 4: 機能要件(設定ファイルの手順)
  if (config?.functional && phases.has('functional')) {
    for (const check of config.functional) {
      const run = CHECKS[check.type];
      if (!run) throw new Error(`未知の check.type: ${check.type}(${check.id})`);
      for (const key of check.viewports ?? ['desktop', 'mobile']) {
        const vp = VIEWPORTS[key];
        const { page, errors } = await openPage(contexts[key], pg.file);
        const rec = new Recorder();
        const screenshots = [];
        const shot = check.screenshot && (async () => {
          await settle(page, 200);
          const file = shotFile(pg.name, vp, check.screenshot);
          await page.screenshot({ path: file, animations: 'disabled' });
          screenshots.push(file);
        });
        try {
          await run({ page, rec, check, shot, viewport: vp, expDir });
        } catch (e) {
          rec.check('手順を最後まで実行できる', false, e.message.split('\n')[0]);
        }
        rec.check('操作中に JS エラーが出ない', errors.js.length === 0 && errors.console.length === 0, [...errors.js, ...errors.console]);
        entry.functional.push({ id: check.id, type: check.type, viewport: vp.label, status: rec.status, steps: rec.steps, screenshots });
        await page.close();
      }
    }
  }
}

await browser.close();

const md = buildMarkdown(result);
const base = path.join(resultDir, `verify-result${rev}`);
await writeFile(`${base}.json`, JSON.stringify(result, null, 2) + '\n');
await writeFile(`${base}.md`, md + '\n');
console.log(md);
console.log(`\n出力: ${base}.json / .md\nスクリーンショット: ${shotsDir}`);
process.exit(exitCode(result, opt.strict));
