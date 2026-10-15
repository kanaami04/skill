# 一般的に良い UI/UX とは — 調査メモ

- 作成日: 2026-10-15
- きっかけ: dashboard-001 の修正1回目のあと、Baseline と案Cが「管理画面に見えなくなった」(人間の評価 3/3)。
- 位置づけ: ルール改善(Phase 2)の材料。**まだ Skill のルールには反映していない。**

出典は末尾。NN/g(Nielsen Norman Group)など研究に基づくものを優先した。ツール会社のブログは、診断は参考にし、解決策は割り引いて扱う。

## 1. 調べて分かった原則

### 1-1. 構造は慣習に従い、差別化は別のところで出す

- **Jakob's Law**: ユーザーは、ほかのサイトやアプリで身につけた期待を持って画面を見る。慣習から外れると、混乱や離脱につながる。
- ただし「全部同じにせよ」ではない。**構造(ナビ、ページの見出し、領域の区切り、表)は慣習どおり**にし、差別化は内容・アイデンティティ・重要な操作で出す、という考え方が紹介されている。

→ 管理画面らしさは、左のナビ、見出し、囲まれた領域、表、ツールバーといった**構造の慣習**から来る。ここを崩すと「管理画面に見えない」。案B(記事・ニュースサイトに見えた)と、修正1回目(枠を全部外した)は、どちらもこの慣習を崩していた。

### 1-2. 囲み(共通領域)は強い。必要なグループだけを囲む

- **Common Region(共通領域)**: 境界の中にある要素は、ひとまとまりと知覚される。境界は、近さ(proximity)や見た目の類似よりも強いグルーピングの手がかりになる。境界の作り方は、枠線・背景色・影のどれでもよい。
- 一方で、**枠が多すぎると視覚的なノイズ**になる。多くの場合、余白と近さだけで整理できる。
- AIっぽさの指摘として、**「カードだらけ」と「カードの入れ子」**が挙がっている。入れ子は階層を平らにし、ごちゃつかせる。代わりに余白・文字・控えめな区切り線を使う。

→ 囲みは「全部」でも「ゼロ」でもなく、**意味のある単位(今日のタスク、プロジェクト一覧、アクティビティ)を1段だけ囲む**のが基本になる。初回の Baseline は「全部カード＋中の行にも線」で多すぎ、修正1回目は「全部外す」で少なすぎた。

### 1-3. 焦点は1つ。強調はすべてに付けると消える

- ダッシュボードは「重要な情報を素早く伝える」ためのもの。
- **前注意的(preattentive)な特徴**: 長さ、位置、大きさ、色などは、探さなくても目に飛び込む。これを**目を向けてほしい1か所**に使う。
- 強い色は鍵となる1つの数値に取っておく。すべてを強調すると、何も目立たない。
- **色は補助の手がかり**にする。主な意味は、形・近さ・グルーピングで伝える。色だけで意味を伝えない(色覚の多様性への配慮も兼ねる)。

→ 初回の Baseline は、状態色6色、行の左線、パネルの線、最優先ラベルが全部同じ強さで競合していた。案Cは、強弱がなく「どこを見ればいいか分からない」状態だった。

### 1-4. 運用ダッシュボードは「1画面で、時間に追われる作業を支える」

- NN/g は、ダッシュボードを**運用型**(時間に追われる作業中に、重要な情報をすぐ伝える)と**分析型**(時間に追われない分析・判断)に分けている。
- どちらも、重要な情報は**操作なしで1画面に見える**ことが求められる。
- 場所を取るわりに情報が少ない要素(円形のゲージなど)は避ける。

→ Northstar のダッシュボードは運用型。案Cの「1画面に収める」方針は、この点では正しい。

### 1-5. 比較する情報は表・リスト、要約はカード

- PatternFly: **繰り返しの多い、密な情報をカードで見せない**。表かデータリストを使う。
- SAP Fiori: カードは、概要ページの入口(プレビュー)として使う。
- 「カードは意味のあるグルーピングを示すもので、レイアウトの余白埋めではない」という指針もある。

### 1-6. 情報を絞り、段階的に開示する

- よくある失敗は「メトリックのスープ」。取れる数値を全部並べ、全部同じ重みで出し、ユーザーに探させる。
- 常に見せる情報、求めに応じて出す情報、上級者向けの隠れた情報、と段階に分ける。
- 見出しを言い直すだけの導入文など、**同じ情報の繰り返し**はノイズになる。

### 1-7. 見た目の良さは、使いやすさの評価そのものを変える

- **Aesthetic-Usability Effect**: 人は、見た目が良いものを使いやすいと判断する。小さな使いにくさも許容されやすくなる。ただし主に第一印象の効果で、使い続けて分かる問題までは隠せない。

→ 「見せるための UI」は飾りではなく、第一印象と信頼感を作る役割がある。一方で、実務で使い続ける画面では、使いやすさがないと持たない。**見せる UI と実務的な UI の折衷**は、この2つを両立させる考え方だと言える。

## 2. 「AIっぽい」と言われる典型(診断)

複数の記事で、原因は共通して説明されている。**指示がないと、モデルは学習データの平均を出す。その平均に見覚えのある型がある。**

| 典型 | 今回の実験で出たか |
|---|---|
| 片側(左)だけ太い色線の付いた角丸の要素。「AI生成UIの最も分かりやすい特徴」とまで言われている | 出た(Baseline 6か所、A 6、B 1、C 14) |
| どこでもカード、カードの入れ子 | 出た(初回の Baseline) |
| 同じ形のカードの並び、大きな数値＋小さなラベルの「ヒーローメトリック」 | 一部(A の「5件」32px) |
| 紫〜青のグラデーション、ガラス風、光る縁取り、汎用的な影 | 出なかった(ルールなしでも) |
| 見出しを言い直す導入文などの情報の繰り返し | 出た(Baseline の注意プロジェクトの重複) |
| 「技術っぽさ」のための等幅フォント | 一部(案Cの ID・時刻) |
| (調査外・今回の観察)淡い背景＋濃い文字のバッジを全状態に使う | 出た(初回の Baseline) |

改善策として「形容詞を足しても直らない(形容詞こそ平均化される)」「具体的な参考プロダクト、間隔のスケール、アクセント色を1つに絞るなどの**具体的な制約**を与える」が挙がっている。

## 3. 今回の実験の観察と、原則の対応

| 観察(人間の評価) | 対応する原則 |
|---|---|
| 初回 Baseline: パネルと行の線が二重で違和感 | 1-2 入れ子の囲み / 2 左の色線 |
| 初回 Baseline: 全行に同じ装飾、どれも同じくらい目立つ | 1-3 焦点は1つ |
| 初回 Baseline: 淡い色が多い | 1-3 色は補助 / 2 淡いバッジ |
| 案B: ニュースサイト・記事に見える | 1-1 構造の慣習を崩した |
| 案C: 整っているが、どこを見ればいいか分からない | 1-3 焦点がない / 1-6 情報が多い |
| 修正1回目(両方): 管理画面に見えなくなった | 1-1 / 1-2 囲みをゼロにして、管理画面の構造の慣習まで消えた |

## 4. ルールへの反映案(Phase 2 の候補)

1. **構造は慣習、差別化は中身**: 管理画面なら、ナビ・見出し・囲まれた領域・表という構造は崩さない。個性は色・文字・データの見せ方・重要な操作で出す。
2. **囲みは1段、意味の単位だけ**: 意味のある領域だけを囲み、入れ子にしない。全部囲むのも、全部外すのも避ける。
3. **焦点を1つ決めてから作る**: 各画面で「最初に目に入れたい1か所」を先に決め、強い色・大きさはそこだけに使う。
4. **左の色線、淡いバッジ、カードを既定にしない**: 使うなら、目的を説明できる1か所に限る。
5. **3案の方向性を見直す**: 今の A/B/C は「見た目の型」を指定していて、B は記事風に流れた。代わりに、**見せる UI と実務 UI の配分**を軸にする案が考えられる。例:
   - 実務寄り: 密度と処理速度を優先。焦点は1つに絞る。
   - 折衷: 実務の構造に、第一印象を良くする要素(余白、文字の階層、ブランド色の一点使い)を足す。
   - 見せる寄り: 第一印象と個性を優先。ただし管理画面の構造の慣習は守る。
6. **評価方法**: 第一印象(一瞬見たとき)を独立した評価項目にする。「管理画面に見えるか」を前提条件として確認する。

## 出典

- [NN/g: Dashboards: Making Charts and Graphs Easier to Understand(前注意的特徴)](https://www.nngroup.com/articles/dashboards-preattentive/)
- [NN/g: Data Visualizations for Dashboards(動画)](https://www.nngroup.com/videos/data-visualizations-dashboards/)
- [NN/g: The Principle of Common Region](https://www.nngroup.com/articles/common-region/)
- [NN/g: Common Region(動画)](https://www.nngroup.com/videos/common-region-gestalt/)
- [NN/g: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/)
- [Wikipedia: Aesthetic–usability effect](https://en.wikipedia.org/wiki/Aesthetic%E2%80%93usability_effect)
- [uxdesign.cc: How Tinder makes you forgive its bad design(美的ユーザビリティ効果の研究の紹介)](https://uxdesign.cc/how-tinder-makes-you-forgive-its-bad-design-3a0ecfe1246b)
- [Helio: Jakob's Law](https://helio.zurb.com/ux-research/laws-of-ux/jakobs-law/)
- [LogRocket: Jakob's Law](https://blog.logrocket.com/ux-design/jakobs-law-creating-user-centric-interfaces)
- [PatternFly: Card design guidelines](https://patternfly.org/v4/components/card/design-guidelines)
- [SAP Fiori: Overview page card](https://www.sap.com/design-system/fiori-design-web/v1-139/page-types/floorplans/overview-page-ovp/overview-page-card/usage)
- [Force UI spec: Card](https://the-force-design-spec-site.public.dev.shared.perforce.com/patterns/components/card/)
- [Impeccable: Anti-patterns](https://mintlify.wiki/pbakaus/impeccable/concepts/anti-patterns)
- [Noqta: AI design slop — overused UI patterns](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026)
- [SuperDesign: Why AI design looks generic](https://www.superdesign.dev/blog/why-ai-design-looks-generic)
- [VP0: Why does my AI app look generic?](https://vp0.com/blogs/why-does-my-ai-app-look-generic)
- [UX Studio: Dashboard design](https://www.uxstudioteam.com/ux-blog/dashboard-design)
- [The New Stack: 5 dashboard design best practices](https://thenewstack.io/5-dashboard-design-best-practices/)
