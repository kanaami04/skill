import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = fileURLToPath(new URL('.', import.meta.url));
const cli = path.join(here, '..', 'verify.mjs');
const good = await readFile(path.join(here, 'fixtures', 'mini-app.html'), 'utf8');

/** mini-app.html に不具合を入れた画面案で実行し、結果の JSON を返す */
async function verify(mutate = (h) => h) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ui-verify-'));
  await mkdir(path.join(dir, 'baseline'));
  await writeFile(path.join(dir, 'baseline', 'index.html'), mutate(good));
  await copyFile(path.join(here, 'fixtures', 'mini-app.config.json'), path.join(dir, 'verify.config.json'));
  const out = path.join(dir, 'out');
  const { code } = await run('node', [cli, dir, '--out', out], { timeout: 60000 }).then(() => ({ code: 0 }), (e) => ({ code: e.code }));
  const result = JSON.parse(await readFile(path.join(out, 'verify-result.json'), 'utf8'));
  const status = Object.fromEntries(result.pages[0].functional.map((f) => [`${f.id}/${f.viewport}`, f.status]));
  return { code, result, status, layout: Object.fromEntries(result.pages[0].viewports.map((v) => [v.viewport, v.layout])) };
}

const bug = (name, code) => (h) => h.replace(`/*BUG:${name}*/`, code);

test('正しい画面は、すべて ○ で終了コード 0', async () => {
  const r = await verify();
  assert.deepEqual(Object.values(r.status).filter((s) => s !== 'pass'), [], JSON.stringify(r.status));
  assert.equal(r.code, 0);
  assert.equal(r.layout[375].hasHorizontalScroll, false);
});

test('絞り込みの範囲: 別欄に同じプロジェクト名があっても、範囲内だけで判定する', async () => {
  // 「注意が必要」欄には P1,P3 が常にある。正しい画面で「保留」「順調」が通ること自体が、範囲を限っている証拠
  const ok = await verify();
  assert.equal(ok.status['filter/1440'], 'pass');
  // 「保留」を押しても絞り込まれない不具合は、別欄に名前があっても検出する
  const broken = await verify((h) => h.replace('filter === \'all\' || p.st === filter /*BUG:filter*/', "filter === 'all' || filter === 'hold' || p.st === filter"));
  assert.equal(broken.status['filter/1440'], 'fail');
  assert.equal(broken.code, 1);
});

test('空の状態: 件数が残っているのに出る / いつまでも出ない を検出する', async () => {
  const early = await verify((h) => h.replace('left === 0/*BUG:empty*/', 'left <= 1'));
  assert.equal(early.status['empty/1440'], 'fail');
  const never = await verify((h) => h.replace('left === 0/*BUG:empty*/', 'false'));
  assert.equal(never.status['empty/1440'], 'fail');
});

test('タスクの完了切り替え: チェックしても状態が変わらない画面を検出する', async () => {
  const r = await verify((h) => h.replace('t.done = e.target.checked; renderTasks();', ''));
  assert.equal(r.status['toggle/1440'], 'fail');
});

test('ナビ: Esc で閉じない画面を検出する', async () => {
  const r = await verify((h) => h.replace("if (e.key === 'Escape') set(false);", ''));
  assert.equal(r.status['nav/375'], 'fail');
  assert.equal(r.status['nav/1440'], undefined); // モバイルだけの確認
});

test('レイアウト: 横スクロールと右端のはみ出しを検出する', async () => {
  const r = await verify((h) => h.replace('<main>', '<main><div style="width:900px;height:20px">wide</div>'));
  assert.equal(r.layout[375].hasHorizontalScroll, true);
  assert.ok(r.layout[375].overflowRight.count >= 1);
  assert.equal(r.layout[1440].hasHorizontalScroll, false);
  assert.equal(r.code, 1);
});

test('JS エラーを検出する', async () => {
  const r = await verify(bug('jserror', 'undefinedFunction();'));
  assert.ok(r.layout[1440].errors.js.length >= 1);
  assert.equal(r.code, 1);
});
