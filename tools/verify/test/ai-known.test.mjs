import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launch, newContext, openPage, inpage, VIEWPORTS } from '../lib/browser.mjs';

const fixture = fileURLToPath(new URL('./fixtures/ai-known.html', import.meta.url));

test('AI典型: 既知の画面で、数える対象だけを数える', async () => {
  const browser = await launch();
  try {
    const ctx = await newContext(browser, VIEWPORTS.desktop);
    const { page } = await openPage(ctx, fixture);
    const a = await inpage(page, 'antiPatterns');

    // 左の色線: border-left ×3、inset の影 ×1、疑似要素の帯 ×1。4辺の枠・下線・影・四角・非表示・画面外は数えない
    assert.equal(a.leftLines.count, 5, JSON.stringify(a.leftLines.items));
    assert.deepEqual(a.leftLines.byKind, { 'border-left': 3, 'inset-shadow': 1, pseudo: 1 });
    assert.equal(a.leftLines.distinctStyles, 4);
    assert.equal(a.leftLines.chromatic, 5);
    assert.equal(a.leftLines.borderLeftAny, 8); // 参考値: 左線3 + 4辺の枠5(.box×2、ctl-box、inner-frame、inner-chip)

    // 小さい要素の背景色: #fde8e8(2個が1種類)、#e8f0fe、#fff4d6 の3種類。文字なし・ボタン内は数えない
    assert.equal(a.badgeBackgrounds.distinctColors, 3, JSON.stringify(a.badgeBackgrounds.colors));
    assert.equal(a.badgeBackgrounds.smallElements, 4);
    assert.equal(a.badgeBackgrounds.distinctPaleColors, 3);

    // 入れ子: 枠の中の枠 ×1 だけ。下線の行と小さいチップは数えない
    assert.equal(a.nestedBoxes.count, 1, JSON.stringify(a.nestedBoxes.items));
  } finally {
    await browser.close();
  }
});
