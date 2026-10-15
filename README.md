# UI Design Rules — Phase 1

AIが生成するWeb UIにありがちな画一的なデザインを減らすための、Claude Code用Skillとルール集。
Skill・Markdown・テンプレートだけで動き、外部のAI APIには依存しない。

この仕組みが担当するのは、**本実装の前に画面を決める段階**。単体のHTML/CSS/JSで画面案を3案作って比べ、採用案をデザイン仕様にまとめる。本実装は仕様が決まってから、別の作業として行う。

## 構成

```
.
├── .claude/skills/ui-design-rules/
│   ├── SKILL.md                    # Skillの入口(使い方の判断と基本フロー)
│   ├── rules/
│   │   ├── 01-principles.md        # 基本原則 Rule 01-05
│   │   ├── 02-anti-patterns.md     # アンチパターン
│   │   ├── 03-design-protocol.md   # 3案の生成プロトコル Step 1-6
│   │   ├── 04-quality-checklist.md # 品質チェックリスト
│   │   ├── 05-experiment.md        # Baseline / Rules の実験方法
│   │   └── 06-roadmap.md           # 開発方針 Phase 1-3
│   └── templates/
│       ├── design-brief.md         # デザインブリーフ
│       ├── comparison.md           # 3案の比較と採用理由
│       ├── design-spec.md          # 採用案のデザイン仕様
│       └── experiment-log.md       # 実験ログ
└── experiments/                    # 実験ごとの成果物(実験IDごとにフォルダ)
```

ルールは `rules/` の各ファイルを編集すれば更新できる。SKILL.md は入口なので、ルール本文は書かない。

## 使い方

このディレクトリで Claude Code を起動すると、Skill が読み込まれる。

- 明示的に呼ぶ: `/ui-design-rules <依頼内容>`
- 自然文でも可: 「このブリーフで画面を3案作って」など、UI作成の依頼で自動的に使われる

別のプロジェクトで使う場合は、`.claude/skills/ui-design-rules/` をそのプロジェクトの `.claude/skills/` にコピーするか、全プロジェクト共通にしたければ `~/.claude/skills/` に置く。

## 最初の実験の手順

1. **画面を1つ決める。** 最初は、情報の優先順位がはっきりしている業務画面が比べやすい(例: 注文一覧、予約管理、問い合わせ受付)。
2. **ブリーフを書く。**
   ```sh
   mkdir -p experiments/<実験ID>/screenshots
   cp .claude/skills/ui-design-rules/templates/design-brief.md experiments/<実験ID>/brief.md
   ```
   実験IDは `2026-10-15-order-list` のように日付+画面名にしておくと並べやすい。
3. **実験ログを用意する。**
   ```sh
   cp .claude/skills/ui-design-rules/templates/experiment-log.md experiments/<実験ID>/experiment-log.md
   ```
   品質の5段階の基準は、生成を見る前に決めておく。
4. **Baseline を作る。** 新しいセッションで、Skill を使わずに依頼する。
   > `experiments/<実験ID>/brief.md` の画面を `experiments/<実験ID>/baseline/index.html` に作って。ui-design-rules のSkillは使わないで。

   開始時刻・終了時刻、修正指示ごとの回数を実験ログに記録する。
5. **Rules を作る。** 別の新しいセッションで依頼する。
   > `/ui-design-rules experiments/<実験ID>/brief.md の画面を作って`

   3案が `experiments/<実験ID>/rules/variant-a.html` などにでき、`comparison.md` に比較が出る。採用案を決めて伝えると `design-spec.md` が出る。
6. **記録する。** 両方のスクリーンショットを `screenshots/` に保存し、実験ログの計測表・採用理由・気づきを埋める。
7. **2つ目以降の画面で繰り返す。** 1画面で結論を出さない。気づきに応じて `rules/` を直す。

## 注意

- Skill は、ユーザーの承認なしに採用案を本番実装へ統合しない。
- 既存プロジェクトで使う場合、実験用の画面は既存ファイルと分離して置く。
