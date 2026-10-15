import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const exists = (p) => stat(p).then(() => true, () => false);

/**
 * 実験フォルダから画面案を探す。
 *   baseline/index.html → "baseline"
 *   rules/<name>.html   → "<name>"(variant-a など)
 * config.pages があればそれを優先する: [{ "name": "...", "file": "相対パス" }]
 */
export async function discoverPages(expDir, config) {
  if (config?.pages) {
    return config.pages.map((p) => ({ name: p.name, file: path.resolve(expDir, p.file) }));
  }
  const pages = [];
  const baseline = path.join(expDir, 'baseline', 'index.html');
  if (await exists(baseline)) pages.push({ name: 'baseline', file: baseline });
  const rulesDir = path.join(expDir, 'rules');
  if (await exists(rulesDir)) {
    for (const f of (await readdir(rulesDir)).filter((f) => f.endsWith('.html')).sort()) {
      pages.push({ name: f.replace(/\.html$/, ''), file: path.join(rulesDir, f) });
    }
  }
  return pages;
}
