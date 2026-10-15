# ui-verify

画面案(単体HTML)をブラウザで検証するツール。`03-design-protocol.md` の Step 5 と、`02-anti-patterns.md` の「AI典型」の数え上げを、繰り返し同じ手順で実行する。

- 画面案の HTML には何も入れない。依存関係はこのフォルダの中だけ(`playwright-core` 1つ)。
- ブラウザはインストール済みの Google Chrome(`channel: 'chrome'`)。ブラウザのダウンロードは不要。
- 判定はすべて計算後のスタイル(`getComputedStyle`、`getBoundingClientRect`)。ソースの文字列検索はしない。

## 使い方

```sh
cd tools/verify
npm install                                   # 初回だけ
node verify.mjs ../../experiments/dashboard-001               # 実験フォルダに出力
node verify.mjs ../../experiments/dashboard-001 --out /tmp/x   # 別の場所に出力
node verify.mjs ../../experiments/dashboard-001 --rev r1       # 修正後(ファイル名に -r1)
```

Node 20 以上(mise の v24 で確認)。終了コードは、レイアウトの崩れ・JS エラー・機能要件の×があると 1(`--strict` で AI典型の上限超えも 1)。

| オプション | 内容 |
|---|---|
| `--out <dir>` | `verify-result.json` / `.md` とスクリーンショット(`<dir>/screenshots/`)の出力先。省略時は実験フォルダ |
| `--shots <dir>` | スクリーンショットだけ別の場所に出す |
| `--rev r1` | 修正後の実行。`variant-a-375-full-r1.png`、`verify-result-r1.json` のようになる |
| `--pages a,b` | 対象を絞る(`baseline`、`variant-a` など) |
| `--only <list>` | `shots,layout,antipatterns,functional` のうち実行するもの |
| `--config <file>` | 設定ファイル(既定: `<実験フォルダ>/verify.config.json`。なくても、1〜3は動く) |
| `--channel <name>` | ブラウザ(既定 `chrome`) |
| `--headed` | ブラウザを表示する |

## 対象の画面

`baseline/index.html` と `rules/*.html` を自動で探す。名前は `baseline`、`variant-a` など。別の置き方なら設定ファイルの `pages` で指定する。

```json
{ "pages": [{ "name": "design", "file": "rules/variant-c.html" }] }
```

## 出力

### スクリーンショット

1440×900 と 375×812(`isMobile`、タッチあり)で、最初の画面とページ全体を撮る。

```
baseline-1440.png / baseline-1440-full.png / baseline-375.png / baseline-375-full.png
variant-a-1440-empty.png   # 設定ファイルの screenshot を指定した手順で撮ったもの(空の状態、ナビを開いた状態)
variant-a-375-full-r1.png  # --rev r1
```

### レイアウト(両ビューポート)

- 横スクロール: `scrollWidth` と指定幅の比較。`html`/`body` の `overflow-x: hidden` で隠れている場合は備考に出す
- 右端からはみ出す要素: スクロール領域の内側に収まる要素(表など)は除く。除いたものは「内部スクロール」として数だけ出す
- ページの高さ、JS エラー、コンソールエラー、外部リクエスト(`file`/`data` 以外)
- 指定幅と `innerWidth` が違う場合(viewport meta がない等)は備考に出す

### AI典型の数

| 項目 | 数え方 |
|---|---|
| 左の色線 | 左だけ、または他の辺より太い `border-left`。`box-shadow` の左の線(inset の +x、または外側の -x、blur 0)。`::before`/`::after` の細い縦の帯。4辺同じ太さの枠は数えない。`有彩色` は灰色の区切り線(`.me` の `border-left: 1px` など)を除いた数。参考値として「border-left が見える要素すべて」も JSON に入る |
| 小要素の背景色 | 高さ 32px 以下・幅 180px 以下で、背景色と短い文字(24字以内)がある要素。ボタン・リンク・入力・表の部品は除く。重ねた結果の色で種類を数え、淡色(明度 0.82 以上)の種類数を併記 |
| 囲みの入れ子 | 囲み(3辺以上の枠、影の輪、外側の影、親と違う背景)の中に、枠または左線のある行・カードサイズの要素(小さいチップ・操作要素・表の部品は除く)があれば1件 |

画面外に退避した要素(閉じたナビなど)と非表示の要素は数えない。内訳(要素名、色、太さ)は JSON の `antiPatterns` にある。

これは「数える」ツールで、上限を超えたかどうかは目安(`△`)として示すだけ。目的を説明できるなら採用してよい、というルールの扱いは変えない。

## 機能要件の設定

実験ごとの `verify.config.json` に手順を書く。dashboard-001 の例は [../../experiments/dashboard-001/verify.config.json](../../experiments/dashboard-001/verify.config.json)。

```json
{
  "functional": [
    { "id": "タスク切替", "type": "taskToggle", "task": "ヘルプ記事の移行範囲を確定する" },
    { "id": "空の状態", "type": "emptyState", "tasks": ["…", "…"], "expectText": "今日の対応はすべて完了", "screenshot": "empty" },
    { "id": "絞り込み", "type": "projectFilter", "scope": "[aria-labelledby=\"h-proj\"]", "projects": { "P1": "…" }, "filters": [{ "label": "順調", "expect": ["P2", "P4"] }] },
    { "id": "ナビ開閉", "type": "navToggle", "viewports": ["mobile"], "screenshot": "nav" }
  ]
}
```

`viewports`(`desktop` / `mobile`)を省略すると両方で実行する。各手順は新しく開いた画面で始まる。

| type | 確認すること |
|---|---|
| `taskToggle` | タスク名を含む行のチェックボックス(見えているもの)をクリックして、状態が変わる・画面の表示が連動する・元に戻せる。同じタスクが複数箇所にあれば状態が一致する |
| `emptyState` | 指定したタスクを順に完了にする。途中では `expectText` が出ず、全部で出る。1件戻すと消える |
| `projectFilter` | `scope` の範囲の文字だけで、表示されているプロジェクト名を判定する(「注意が必要なプロジェクト」など別欄は見ない)。ボタンは文字(件数が付いていてもよい)で探し、選択状態の属性(`aria-pressed` など)も確認する |
| `navToggle` | `aria-expanded` を持つ見えているボタン。初期は閉じている → ボタンで開く → ボタンで閉じる → 再び開く → Esc で閉じる。`aria-controls` の先が画面内に出る/消えることも確認する |
| `script` | 実験フォルダの `.mjs` を呼ぶ。下を参照 |

- チェックボックスの探し方: チェックボックスから親をたどり、タスク名を含み、チェックボックスがその1つだけの要素を「行」とみなす。デザインに依存しない。
- `scope` は CSS セレクタ(Playwright の拡張も使える)。見出しで指定するなら `section:has(h2:text-is("プロジェクト一覧"))`。
- 実クリックが届かないチェックボックスは、DOM クリックにフォールバックして `△` にする。

### 手順をスクリプトで書く

`{ "id": "並び替え", "type": "script", "path": "custom/sort.mjs" }` と書くと、実験フォルダの `custom/sort.mjs` を呼ぶ。

```js
export default async function ({ page, rec, check, shot, viewport }) {
  await page.getByRole('button', { name: '期限順' }).click();
  const first = await page.locator('[data-task]').first().innerText();
  rec.check('期限順で先頭が変わる', first.includes('T-101'), first);
  await shot?.();   // check.screenshot を指定していれば撮る
}
```

`rec.check(ラベル, 真偽, 詳細)`(×になる)、`rec.warn(ラベル)`(△)、`rec.info(ラベル)`。`page` は Playwright の Page。

## 結果

コンソールに Markdown の表を出し、同じ内容を `verify-result.md` に、全データを `verify-result.json` に書く。実験ログには `.md` をそのまま貼れる。`○` 通過、`△` 要確認、`×` 不具合。

## テスト

```sh
npm test
```

- `test/ai-known.test.mjs`: 数える/数えないものを既知の数で仕込んだ画面で、検出器が期待どおり数えるか。
- `test/functional.test.mjs`: 小さな画面に不具合(Esc で閉じない、絞り込めない、空の表示が早すぎる/出ない、横スクロール、JS エラー)を入れ、○ のまま通らず × になるか。

## 限界

- 判定のしきい値(小要素 32×180px、淡色 0.82 など)は目安。一覧の内訳を見て判断する。
- 「第一印象」「焦点が合っているか」など、見て判断する項目は扱わない。スクリーンショットを人が見る。
- 文字のはみ出し(切れ・重なり)は、横スクロールと右端のはみ出し以外は確認しない。
