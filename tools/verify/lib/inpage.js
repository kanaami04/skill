/*
 * ブラウザのページ内で実行する計測コード。
 * Node 側(lib/*.mjs)が page.evaluate で読み込み、window.__verify に関数を登録する。
 * ページの DOM は変更しない(functional のチェックボックス探索だけ data 属性を付ける)。
 * 判定はすべて getComputedStyle / getBoundingClientRect。ソースの文字列検索はしない。
 */
(() => {
  // ---------- 共通 ----------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'BR', 'DEFS', 'SYMBOL', 'CLIPPATH', 'MASK']);
  const INTERACTIVE = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="tab"], [role="switch"]';
  const TABLE_PARTS = new Set(['TR', 'TD', 'TH', 'THEAD', 'TBODY', 'TFOOT', 'CAPTION', 'COLGROUP', 'COL']);

  const cache = new Map();
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);

  function inSvg(el) {
    return el.namespaceURI === 'http://www.w3.org/2000/svg' && el.tagName.toLowerCase() !== 'svg' ||
      (el.parentElement && el.parentElement.closest('svg') !== null);
  }

  function describe(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
    if (cls.length) s += '.' + cls.slice(0, 2).join('.');
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return text ? `${s} 「${text.slice(0, 24)}${text.length > 24 ? '…' : ''}」` : s;
  }

  const rendered = (el) => {
    if (!el.checkVisibility({ checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 文書の外(閉じたナビが画面外に退避している等)にある要素
  function offDocument(r) {
    const de = document.documentElement;
    return r.right <= 0 || r.bottom <= 0 || r.left >= Math.max(de.scrollWidth, innerWidth);
  }

  // ---------- 色 ----------
  const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/;
  let canvasCtx = null;

  function parseColor(str) {
    if (cache.has(str)) return cache.get(str);
    let out;
    const m = RGB_RE.exec(str.trim());
    if (m) {
      out = { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4] };
    } else if (str === 'transparent') {
      out = { r: 0, g: 0, b: 0, a: 0 };
    } else {
      // oklch() / color() / color-mix() などは canvas で sRGB に落とす(透明度は概算)
      canvasCtx ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
      canvasCtx.clearRect(0, 0, 1, 1);
      canvasCtx.fillStyle = '#000';
      canvasCtx.fillStyle = str;
      canvasCtx.fillRect(0, 0, 1, 1);
      const d = canvasCtx.getImageData(0, 0, 1, 1).data;
      out = d[3] === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: Math.round(d[0] * 255 / d[3]), g: Math.round(d[1] * 255 / d[3]), b: Math.round(d[2] * 255 / d[3]), a: d[3] / 255 };
    }
    cache.set(str, out);
    return out;
  }

  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // 要素の背景が実際に見える色(祖先の背景に重ねた結果)。不透明な祖先まで遡る
  function effectiveBg(el, includeSelf = true) {
    const layers = [];
    let cur = includeSelf ? el : el.parentElement;
    while (cur) {
      const c = parseColor(cs(cur).backgroundColor);
      if (c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      cur = cur.parentElement;
    }
    let out = { r: 255, g: 255, b: 255 };
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) };
    }
    return out;
  }

  function lightness(c) {
    const max = Math.max(c.r, c.g, c.b) / 255;
    const min = Math.min(c.r, c.g, c.b) / 255;
    return (max + min) / 2;
  }

  const colorDist = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

  // ---------- 枠・左線・影 ----------
  const SIDES = ['top', 'right', 'bottom', 'left'];

  function borders(style) {
    const out = {};
    for (const s of SIDES) {
      const w = parseFloat(style[`border-${s}-width`]) || 0;
      const st = style[`border-${s}-style`];
      const col = parseColor(style[`border-${s}-color`]);
      out[s] = { w, visible: w > 0 && st !== 'none' && st !== 'hidden' && col.a > 0, color: style[`border-${s}-color`] };
    }
    return out;
  }

  function parseShadows(value) {
    if (!value || value === 'none') return [];
    const parts = [];
    let depth = 0;
    let cur = '';
    for (const ch of value) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts.map((p) => {
      const inset = /\binset\b/.test(p);
      const colorMatch = p.match(/(?:rgba?|hsla?|color|oklch|oklab|lab|lch)\([^)]*\)|#[0-9a-f]{3,8}/i);
      const nums = (p.replace(colorMatch ? colorMatch[0] : '', '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      const [x = 0, y = 0, blur = 0, spread = 0] = nums;
      return { inset, x, y, blur, spread, color: colorMatch ? colorMatch[0] : '' };
    });
  }

  // 片側の線として描く影(blur 0、y 0)。inset の +x は左の線、外側の -x も左の線
  function shadowLeftLines(style) {
    return parseShadows(style.boxShadow)
      .filter((s) => s.blur === 0 && s.y === 0 && s.spread === 0 && ((s.inset && s.x > 0) || (!s.inset && s.x < 0)) && parseColor(s.color).a > 0)
      .map((s) => ({ kind: 'inset-shadow', width: Math.abs(s.x), color: s.color }));
  }

  // 枠(囲み)を影で描いているか: 0 0 0 Npx
  function hasRingShadow(style) {
    return parseShadows(style.boxShadow).some((s) => s.blur === 0 && s.x === 0 && s.y === 0 && s.spread > 0 && parseColor(s.color).a > 0);
  }

  function hasOuterShadow(style) {
    return parseShadows(style.boxShadow).some((s) => !s.inset && s.blur > 0 && parseColor(s.color).a > 0);
  }

  // 疑似要素で描く細い縦の帯(::before / ::after)
  function pseudoStripes(el) {
    const out = [];
    for (const p of ['::before', '::after']) {
      const s = cs(el, p);
      if (s.content === 'none' || s.content === 'normal' || s.display === 'none') continue;
      const w = parseFloat(s.width);
      const h = parseFloat(s.height);
      const bg = parseColor(s.backgroundColor);
      if (!(w > 0 && h > 0) || bg.a === 0) continue;
      const left = parseFloat(s.left);
      const stripe = w <= 8 && h >= 12 && h >= w * 2 && (s.position === 'absolute' || s.position === 'fixed') && (Number.isNaN(left) || left <= 8);
      if (stripe) out.push({ kind: 'pseudo', width: w, color: s.backgroundColor });
    }
    return out;
  }

  // 枠: 4辺のうち3辺以上に線、または影の輪
  function frameOf(style) {
    const b = borders(style);
    const n = SIDES.filter((s) => b[s].visible).length;
    return n >= 3 || hasRingShadow(style);
  }

  // 左の色線(片側または他の辺より太い左の線)。4辺同じ太さの枠は数えない
  function leftLinesOf(el, style) {
    const b = borders(style);
    const found = [];
    if (b.left.visible) {
      const others = Math.max(0, ...['top', 'right', 'bottom'].filter((s) => b[s].visible).map((s) => b[s].w));
      if (b.left.w > others) found.push({ kind: 'border-left', width: b.left.w, color: b.left.color });
    }
    found.push(...shadowLeftLines(style));
    found.push(...pseudoStripes(el));
    return found;
  }

  function allElements() {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (SKIP_TAGS.has(el.tagName) || inSvg(el)) continue;
      if (!rendered(el)) continue;
      if (offDocument(el.getBoundingClientRect())) continue;
      out.push(el);
    }
    return out;
  }

  // ---------- レイアウト ----------
  function layout({ refWidth, limit = 15 }) {
    const de = document.documentElement;
    // 基準は指定した幅。モバイルでは幅を超える要素があると Chrome が表示領域ごと広げる(innerWidth が増える)ため
    const vw = refWidth;
    const scrollWidth = Math.max(de.scrollWidth, document.body.scrollWidth);
    const overflowMask = ['hidden', 'clip'].includes(cs(de).overflowX) || ['hidden', 'clip'].includes(cs(document.body).overflowX);

    // 右端からはみ出す要素。スクロール/クリップする祖先の内側に収まるものは除く
    const flagged = new Set();
    const items = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (SKIP_TAGS.has(el.tagName) || inSvg(el)) continue;
      const style = cs(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) continue; // sr-only
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= vw + 1) continue;
      let excused = false;
      for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
        const ps = cs(p);
        if (ps.overflowX !== 'visible') {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1) { excused = true; break; }
        }
      }
      if (excused) continue;
      flagged.add(el);
      items.push({ el, r });
    }
    const top = items.filter(({ el }) => !(el.parentElement && flagged.has(el.parentElement)));
    const overflowing = top.slice(0, limit).map(({ el, r }) => ({
      element: describe(el),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
    }));

    // 要素内でスクロールする領域(表など)。モバイルで想定どおりか確認する材料
    const innerScrollers = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (SKIP_TAGS.has(el.tagName) || inSvg(el)) continue;
      const style = cs(el);
      if (!['auto', 'scroll'].includes(style.overflowX)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        innerScrollers.push({ element: describe(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth });
      }
    }

    return {
      viewport: { configured: refWidth, innerWidth, innerHeight },
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      scrollWidth,
      hasHorizontalScroll: scrollWidth > vw + 1,
      overflowXMasked: overflowMask,
      pageHeight: Math.max(de.scrollHeight, document.body.scrollHeight),
      overflowRight: { count: top.length, items: overflowing },
      innerScrollers,
    };
  }

  // ---------- AI典型 ----------
  function antiPatterns({ limit = 10 } = {}) {
    const els = allElements();
    const styleOf = new Map(els.map((el) => [el, cs(el)]));

    // 1. 左の色線
    const leftLines = [];
    let borderLeftAny = 0;
    for (const el of els) {
      const style = styleOf.get(el);
      if (borders(style).left.visible) borderLeftAny++;
      for (const l of leftLinesOf(el, style)) leftLines.push({ el, ...l });
    }
    const leftKinds = {};
    const leftStyles = new Map();
    let chromatic = 0;
    for (const l of leftLines) {
      const c = parseColor(l.color);
      if (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 40) chromatic++; // 灰色の区切り線と区別する
      leftKinds[l.kind] = (leftKinds[l.kind] || 0) + 1;
      const key = `${l.kind} ${l.width}px ${hex(parseColor(l.color))}`;
      leftStyles.set(key, (leftStyles.get(key) || 0) + 1);
    }

    // 2. 小さい要素の背景色(バッジ)。操作要素・表の部品は除く
    const smallBg = [];
    for (const el of els) {
      if (TABLE_PARTS.has(el.tagName) || el.closest(INTERACTIVE)) continue;
      const style = styleOf.get(el);
      if (parseColor(style.backgroundColor).a === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 32 || r.width > 180) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 24) continue;
      smallBg.push({ el, text, color: effectiveBg(el) });
    }
    const dedup = smallBg.filter((a) => !smallBg.some((b) => b !== a && a.el.contains(b.el) && a.text === b.text));
    const byColor = new Map();
    for (const b of dedup) {
      const key = hex(b.color);
      const entry = byColor.get(key) || { color: key, lightness: +lightness(b.color).toFixed(2), count: 0, samples: [] };
      entry.count++;
      if (entry.samples.length < 3 && !entry.samples.includes(b.text)) entry.samples.push(b.text);
      byColor.set(key, entry);
    }
    const colors = [...byColor.values()].sort((a, b) => b.count - a.count);
    const PALE = 0.82;

    // 3. 囲みの入れ子: 囲み(枠・背景・影)の中に、さらに枠か左線のある行/カードサイズの要素
    const isContainer = (el) => {
      if (el === document.body || el === document.documentElement) return false;
      const style = cs(el);
      if (frameOf(style) || hasOuterShadow(style)) return true;
      const own = parseColor(style.backgroundColor);
      return own.a > 0 && colorDist(effectiveBg(el), effectiveBg(el, false)) > 8;
    };
    const containerMemo = new Map();
    const containerOf = (el) => {
      if (!containerMemo.has(el)) containerMemo.set(el, isContainer(el));
      return containerMemo.get(el);
    };
    const nested = [];
    for (const el of els) {
      if (TABLE_PARTS.has(el.tagName) || el.closest(INTERACTIVE)) continue;
      const style = styleOf.get(el);
      const r = el.getBoundingClientRect();
      if (r.height <= 32 && r.width <= 160) continue; // バッジ・チップ大は対象外
      const marks = frameOf(style) ? 'frame' : leftLinesOf(el, style).length ? 'left-line' : null;
      if (!marks) continue;
      let depth = 0;
      let nearest = null;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (containerOf(p)) { depth++; nearest ||= p; }
      }
      if (nearest) nested.push({ el, container: nearest, marks, depth });
    }

    const sample = (list, fn) => list.slice(0, limit).map(fn);
    return {
      leftLines: {
        count: leftLines.length,
        chromatic, // うち有彩色(灰色の区切り線を除く)
        byKind: leftKinds,
        distinctStyles: leftStyles.size,
        styles: [...leftStyles].map(([style, count]) => ({ style, count })),
        borderLeftAny, // 参考: border-left が見える要素すべて(4辺の枠を含む)
        items: sample(leftLines, (l) => ({ element: describe(l.el), kind: l.kind, width: l.width, color: hex(parseColor(l.color)) })),
      },
      badgeBackgrounds: {
        smallElements: dedup.length,
        distinctColors: colors.length,
        distinctPaleColors: colors.filter((c) => c.lightness >= PALE).length,
        paleThreshold: PALE,
        colors,
      },
      nestedBoxes: {
        count: nested.length,
        maxDepth: nested.reduce((m, n) => Math.max(m, n.depth + 1), 0),
        items: sample(nested, (n) => ({ child: describe(n.el), marks: n.marks, container: describe(n.container) })),
      },
    };
  }

  // ---------- 機能確認の補助 ----------
  const norm = (s) => (s || '').replace(/\s+/g, '');

  // タスク名を含む行のチェックボックスを探し、data-verify-cb を付ける
  function tagCheckboxes(name) {
    document.querySelectorAll('[data-verify-cb]').forEach((e) => e.removeAttribute('data-verify-cb'));
    const target = norm(name);
    const boxes = [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]')];
    const out = [];
    for (const cb of boxes) {
      let row = cb.parentElement;
      while (row && row !== document.body) {
        const own = row.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]').length;
        const label = norm(row.textContent) + norm(cb.getAttribute('aria-label'));
        if (own === 1 && label.includes(target)) break;
        row = row.parentElement;
      }
      if (!row || row === document.body) continue;
      const r = cb.getBoundingClientRect();
      const label = cb.closest('label');
      const lr = label ? label.getBoundingClientRect() : null;
      const visible = cb.checkVisibility({ checkVisibilityCSS: true }) && ((r.width > 0 && r.height > 0) || (lr && lr.width > 0 && lr.height > 0));
      const id = String(out.length);
      cb.setAttribute('data-verify-cb', id);
      out.push({
        id,
        visible: !!visible,
        checked: cb.matches('input') ? cb.checked : cb.getAttribute('aria-checked') === 'true',
        row: describe(row),
      });
    }
    return out;
  }

  function rectInViewport(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  }

  function isShown(el) {
    return !!el && el.checkVisibility({ checkVisibilityCSS: true }) && rectInViewport(el);
  }

  window.__verify = { layout, antiPatterns, tagCheckboxes, isShown, describe };
})();
