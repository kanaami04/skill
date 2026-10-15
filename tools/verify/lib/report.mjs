const MARK = { pass: '○', warn: '△', fail: '×' };
const LIMIT = { leftLines: 0, nestedBoxes: 0 };

export function layoutStatus(l) {
  if (l.hasHorizontalScroll || l.overflowRight.count > 0 || l.errors.js.length || l.errors.console.length) return 'fail';
  if (l.overflowXMasked || l.errors.external.length || l.viewport.innerWidth !== l.viewport.configured) return 'warn';
  return 'pass';
}

export function buildMarkdown(result) {
  const { meta, pages } = result;
  const lines = [];
  const out = (s = '') => lines.push(s);

  out(`## 画面案の検証結果 — ${meta.experiment}${meta.rev ? ` (${meta.rev})` : ''}`);
  out();
  out(`- 実行: ${meta.generatedAt} / ${meta.browser} / ui-verify ${meta.toolVersion}`);
  out(`- ビューポート: ${meta.viewports.join('、')}。判定はすべて計算後のスタイル(getComputedStyle)`);
  out();

  const has = (key) => pages.some((p) => p.viewports.some((v) => v[key]));

  if (has('layout')) {
  out('### レイアウト');
  out();
  out('| 画面 | VP | 横スクロール | 右端からはみ出す要素 | ページの高さ | JSエラー | コンソールエラー | 備考 |');
  out('|---|---|---|---|---|---|---|---|');
  for (const p of pages) {
    for (const v of p.viewports) {
      const vp = v.viewport;
      const l = v.layout;
      if (!l) continue;
      const notes = [];
      if (l.overflowXMasked) notes.push('html/body が overflow-x を隠している');
      if (l.viewport.innerWidth !== l.viewport.configured) notes.push(`innerWidth=${l.viewport.innerWidth}${l.hasViewportMeta ? '' : '(viewport meta なし)'}`);
      if (l.errors.external.length) notes.push(`外部リクエスト ${l.errors.external.length}件`);
      if (l.innerScrollers.length) notes.push(`内部スクロール ${l.innerScrollers.length}か所`);
      out(
        `| ${p.name} | ${vp} | ${l.hasHorizontalScroll ? `× あり(${l.scrollWidth}>${l.viewport.configured})` : '○ なし'} | ${l.overflowRight.count ? `× ${l.overflowRight.count}件` : '○ なし'} | ${l.pageHeight}px | ${l.errors.js.length ? `× ${l.errors.js.length}件` : '○ 0'} | ${l.errors.console.length ? `× ${l.errors.console.length}件` : '○ 0'} | ${notes.join('、')} |`,
      );
    }
  }
  out();
  }

  if (has('antiPatterns')) {
  out('### AI典型の数(上限は 02-anti-patterns.md)');
  out();
  out('| 画面 | VP | 左の色線 | 小要素の背景色の種類(うち淡色) | 囲みの入れ子 |');
  out('|---|---|---|---|---|');
  for (const p of pages) {
    for (const v of p.viewports) {
      const vp = v.viewport;
      const a = v.antiPatterns;
      if (!a) continue;
      const left = `${a.leftLines.count}${a.leftLines.count > LIMIT.leftLines ? ' △' : ''}${a.leftLines.count ? `(有彩色${a.leftLines.chromatic}、${a.leftLines.distinctStyles}種)` : ''}`;
      const bg = `${a.badgeBackgrounds.distinctColors}(${a.badgeBackgrounds.distinctPaleColors})`;
      const nest = `${a.nestedBoxes.count}${a.nestedBoxes.count > LIMIT.nestedBoxes ? ' △' : ''}`;
      out(`| ${p.name} | ${vp} | ${left} | ${bg} | ${nest} |`);
    }
  }
  out();
  out(`上限: 左の色線 ${LIMIT.leftLines}(使うなら目的を説明できる1種類だけ)、囲みの入れ子 ${LIMIT.nestedBoxes}。△ は上限超え。背景色の種類は「色の面は注意の段階だけ」の確認用で、数の上限はない。`);
  out();
  }

  const checkIds = [...new Set(pages.flatMap((p) => p.functional.map((f) => f.id)))];
  if (checkIds.length) {
    out('### 機能要件');
    out();
    out(`| 画面 | VP | ${checkIds.join(' | ')} |`);
    out(`|---|---|${checkIds.map(() => '---').join('|')}|`);
    for (const p of pages) {
      const vps = [...new Set(p.functional.map((f) => f.viewport))];
      for (const vp of vps) {
        const cells = checkIds.map((id) => {
          const f = p.functional.find((x) => x.id === id && x.viewport === vp);
          return f ? MARK[f.status] : '—';
        });
        out(`| ${p.name} | ${vp} | ${cells.join(' | ')} |`);
      }
    }
    out();
    const problems = pages.flatMap((p) => p.functional.flatMap((f) => f.steps.filter((s) => s.result === 'fail' || s.result === 'warn').map((s) => `- ${MARK[s.result === 'fail' ? 'fail' : 'warn']} ${p.name} / ${f.viewport} / ${f.id}: ${s.label}${s.detail ? ` — ${Array.isArray(s.detail) ? s.detail.join('; ') : s.detail}` : ''}`)));
    if (problems.length) {
      out('機能要件の×・△:');
      out();
      lines.push(...problems);
      out();
    }
  }

  const detail = [];
  for (const p of pages) {
    for (const v of p.viewports) {
      const vp = v.viewport;
      const a = v.antiPatterns;
      if (!a) continue;
      if (a.leftLines.count) detail.push(`- ${p.name} / ${vp} 左の色線: ${a.leftLines.styles.map((s) => `${s.style} ×${s.count}`).join('、')}`);
      if (a.nestedBoxes.count) detail.push(`- ${p.name} / ${vp} 入れ子の例: ${a.nestedBoxes.items.slice(0, 3).map((n) => `${n.child} ⊂ ${n.container}`).join(' | ')}`);
    }
  }
  if (detail.length) {
    out('AI典型の内訳(一部):');
    out();
    lines.push(...detail);
    out();
  }

  const overflowDetail = pages.flatMap((p) => p.viewports.flatMap((v) => (v.layout?.overflowRight.items ?? []).slice(0, 3).map((i) => `- ${p.name} / ${v.viewport}: ${i.element} (right=${i.right}, width=${i.width})`)));
  if (overflowDetail.length) {
    out('右端からはみ出す要素(一部):');
    out();
    lines.push(...overflowDetail);
    out();
  }
  return lines.join('\n');
}

export function exitCode(result, strict) {
  for (const p of result.pages) {
    for (const v of p.viewports) {
      if (v.layout && layoutStatus(v.layout) === 'fail') return 1;
      if (strict && v.antiPatterns && (v.antiPatterns.leftLines.count > LIMIT.leftLines || v.antiPatterns.nestedBoxes.count > LIMIT.nestedBoxes)) return 1;
    }
    if (p.functional.some((f) => f.status === 'fail')) return 1;
  }
  return 0;
}
