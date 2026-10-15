import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inpage, settle } from './browser.mjs';

/** 手順の結果を集める。status は fail > warn > pass の順で決まる */
export class Recorder {
  steps = [];
  check(label, ok, detail) {
    this.steps.push({ result: ok ? 'pass' : 'fail', label, ...(detail !== undefined && { detail }) });
    return ok;
  }
  warn(label, detail) {
    this.steps.push({ result: 'warn', label, ...(detail !== undefined && { detail }) });
  }
  info(label, detail) {
    this.steps.push({ result: 'info', label, ...(detail !== undefined && { detail }) });
  }
  get status() {
    if (this.steps.some((s) => s.result === 'fail')) return 'fail';
    if (this.steps.some((s) => s.result === 'warn')) return 'warn';
    return 'pass';
  }
}

const norm = (s) => (s || '').replace(/\s+/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function until(fn, timeout = 1500) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);

// ---------- タスクの完了切り替え ----------

/** タスク名を含む行のチェックボックス(見えているものだけ) */
async function visibleBoxes(page, task) {
  const all = await inpage(page, 'tagCheckboxes', task);
  return all.filter((b) => b.visible);
}

/** 1回クリックして、状態が変わるまで待つ。実クリックが届かない場合だけ DOM クリックにフォールバック */
async function toggleTask(page, task, rec) {
  const before = await visibleBoxes(page, task);
  if (!before.length) {
    rec.check(`「${task}」のチェックボックスが見つかる`, false, '行が見つからない、またはチェックボックスが見えない');
    return null;
  }
  const target = page.locator(`[data-verify-cb="${before[0].id}"]`);
  let via = 'click';
  try {
    await target.click({ timeout: 2500 });
  } catch (e) {
    via = 'dom-click';
    rec.warn(`「${task}」のチェックボックスを実際にクリックできない`, e.message.split('\n')[0]);
    await target.evaluate((el) => (el.closest('label') || el).click());
  }
  await settle(page, 50);
  const after = await visibleBoxes(page, task);
  return { before, after, via };
}

export async function taskToggle({ page, rec, check }) {
  const task = check.task;
  const textBefore = await bodyText(page);
  const first = await toggleTask(page, task, rec);
  if (!first) return;
  const initial = first.before[0].checked;
  rec.info(`「${task}」の初期状態`, initial ? '完了' : '未完了');
  if (!first.after.length) {
    rec.warn(`切り替え後、「${task}」が見える一覧から消えた`, '状態の確認と元に戻す操作は、この画面では確認できない');
  } else {
    rec.check(`チェック状態が切り替わる(${initial ? '完了→未完了' : '未完了→完了'})`, first.after.every((b) => b.checked === !initial), first.after.map((b) => `${b.row}: ${b.checked}`));
    if (first.after.length > 1) rec.check('同じタスクが複数箇所にある場合、状態が一致する', new Set(first.after.map((b) => b.checked)).size === 1);
  }
  const textChanged = (await bodyText(page)) !== textBefore;
  rec.check('画面の表示が連動して変わる(件数・文言など)', textChanged);
  if (first.after.length) {
    const second = await toggleTask(page, task, rec);
    if (second) {
      rec.check(`元に戻せる(初期状態 ${initial ? '完了' : '未完了'} に戻る)`, second.after.length > 0 && second.after.every((b) => b.checked === initial));
    }
  }
}

// ---------- 空の状態 ----------

export async function emptyState({ page, rec, check, shot }) {
  const text = check.expectText;
  const has = async () => norm(await bodyText(page)).includes(norm(text));
  rec.check(`初期状態では「${text}」が出ていない`, !(await has()));
  let done = 0;
  for (const task of check.tasks) {
    const r = await toggleTask(page, task, rec);
    if (!r) return;
    done++;
    if (done < check.tasks.length && (await has())) {
      rec.check(`${done}/${check.tasks.length} 件完了の時点では「${text}」が出ていない`, false);
      return;
    }
  }
  const shown = await until(has);
  rec.check(`${check.tasks.length} 件すべて完了すると「${text}」が出る`, shown);
  if (shot) await shot();
  if (check.reopen !== false && shown) {
    const r = await toggleTask(page, check.tasks[0], rec);
    if (r?.after.length) rec.check('1件を未完了に戻すと、完了表示が消える', await until(async () => !(await has())));
    else rec.warn('完了にした行が一覧から消えているため、元に戻す確認ができない');
  }
}

// ---------- プロジェクトの絞り込み ----------

export async function projectFilter({ page, rec, check }) {
  const scope = page.locator(check.scope);
  const n = await scope.count();
  if (!rec.check(`絞り込みの範囲 ${check.scope} が1つに決まる`, n === 1, `${n} 件`)) return;

  const names = check.projects; // { P1: "会員アプリ v2 リニューアル", ... }
  const read = async () => {
    const text = norm(await scope.innerText());
    return Object.keys(names).filter((id) => text.includes(norm(names[id])));
  };
  const compare = (got, expect) => {
    const missing = expect.filter((id) => !got.includes(id));
    const extra = got.filter((id) => !expect.includes(id));
    return { ok: !missing.length && !extra.length, detail: `表示: ${got.join(',') || 'なし'}${missing.length ? ` / 足りない: ${missing}` : ''}${extra.length ? ` / 余分: ${extra}` : ''}` };
  };

  const all = check.filters.find((f) => f.label === check.initial) ?? check.filters[0];
  const init = compare(await read(), all.expect);
  rec.check(`初期表示は「${all.label}」の内容`, init.ok, init.detail);

  for (const f of check.filters) {
    const re = new RegExp(`^[\\s\\d()（）]*${escapeRe(f.label)}[\\s\\d()（）]*$`);
    const buttons = scope.locator('button, [role="button"], [role="tab"], [role="radio"]').filter({ hasText: re }).and(page.locator(':visible'));
    const count = await buttons.count();
    if (!rec.check(`ボタン「${f.label}」が範囲内に1つある`, count === 1, `${count} 件`)) continue;
    await buttons.click();
    await settle(page, 50);
    const got = compare(await read(), f.expect);
    rec.check(`「${f.label}」で ${f.expect.join(',')} だけが表示される`, got.ok, got.detail);
    const state = await buttons.evaluate((el) => ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current'].map((a) => [a, el.getAttribute(a)]).find(([, v]) => v !== null) ?? null);
    if (!state) rec.warn(`ボタン「${f.label}」に選択状態の属性(aria-pressed など)がない`);
    else rec.check(`ボタン「${f.label}」の選択状態が ${state[0]} に出る`, state[1] === 'true' || state[1] === 'page', `${state[0]}=${state[1]}`);
  }
}

// ---------- モバイルのナビ開閉 ----------

export async function navToggle({ page, rec, check, shot }) {
  const toggles = page.locator(`${check.toggle ?? 'button[aria-expanded]'}:visible`);
  const n = await toggles.count();
  if (!rec.check('aria-expanded を持つボタンが見えている', n >= 1, `${n} 件`)) return;
  if (n > 1) rec.warn('aria-expanded のボタンが複数ある。最初の1つを使う', check.toggle ? undefined : 'toggle で絞り込める');
  const btn = toggles.first();
  const targetId = await btn.getAttribute('aria-controls');
  const target = check.target ?? (targetId ? `#${targetId}` : null);
  if (!target) rec.warn('aria-controls がなく、ナビ本体の表示は確認できない');

  const expanded = () => btn.getAttribute('aria-expanded');
  const shown = () => (target ? page.evaluate((sel) => window.__verify.isShown(document.querySelector(sel)), target) : null);
  const expect = async (label, value) => {
    const ok = await until(async () => (await expanded()) === String(value) && (target ? (await shown()) === value : true));
    rec.check(label, !!ok, `aria-expanded=${await expanded()}${target ? `, ナビ表示=${await shown()}` : ''}`);
  };

  // 開いたナビがボタンに重なって押せない画面もある。その場合は△にして、Esc で閉じる確認に進む
  const press = async (label) => {
    try {
      await btn.click({ timeout: 2000 });
      return true;
    } catch (e) {
      rec.warn(`${label}: ボタンを押せない(他の要素が重なっている)`, e.message.split('\n')[0]);
      return false;
    }
  };

  await expect('初期状態は閉じている', false);
  if (!(await press('開く'))) return;
  await expect('ボタンで開く', true);
  if (shot) await shot();
  if (await press('閉じる')) {
    await expect('もう一度ボタンで閉じる', false);
    if (!(await press('再び開く'))) return;
    await expect('再び開く', true);
  }
  await page.keyboard.press('Escape');
  await expect('Esc キーで閉じる', false);
}

// ---------- 実験ごとのスクリプト ----------

/** 実験フォルダの .mjs を呼ぶ。default export は async (ctx) => void。ctx = { page, rec, check, shot, viewport } */
export async function script(ctx) {
  const mod = await import(pathToFileURL(path.resolve(ctx.expDir, ctx.check.path)).href);
  await mod.default(ctx);
}

export const CHECKS = { taskToggle, emptyState, projectFilter, navToggle, script };
