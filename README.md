# UI Design Rules

AIが生成するWeb UIにありがちな画一的なデザインを減らすための、Claude Code用Skillとルール集。
Skill・Markdown・テンプレートだけで動き、外部のAI APIには依存しない。

この仕組みが担当するのは、**本実装の前に画面を決める段階**。単体のHTML/CSS/JSで画面案を3案作って比べ、採用案を修正し、デザイン仕様にまとめる。本実装は仕様が決まってから、別の作業として行う。

現在は Phase 2(ルールの改善)。ルールは v3。改訂の内容と根拠は [rules/06-roadmap.md](.claude/skills/ui-design-rules/rules/06-roadmap.md) の改訂履歴にある。

## 構成

```
.
├── .claude/skills/ui-design-rules/
│   ├── SKILL.md                    # Skillの入口(使い方の判断と基本フロー)
│   ├── rules/
│   │   ├── 01-principles.md        # 基本原則 Rule 01-06
│   │   ├── 02-anti-patterns.md     # アンチパターンと AI典型(数える対象と上限)
│   │   ├── 03-design-protocol.md   # 3案の生成プロトコル Step 1-8
│   │   ├── 04-quality-checklist.md # 品質チェックリスト(第一印象から)
│   │   ├── 05-experiment.md        # Baseline / Rules の実験方法
│   │   └── 06-roadmap.md           # 開発方針と改訂履歴
│   └── templates/
│       ├── requirements.md         # 画面要件(Baseline にも渡せる)
│       ├── comparison.md           # 3案の比較、採用、修正記録
│       ├── design-spec.md          # 採用案のデザイン仕様
│       └── experiment-log.md       # 実験設計と実験ログ(評価者用)
├── experiments/                    # 実験ごとの成果物
│   └── dashboard-001/              # 最初の実験(ルール v1。Baseline が勝った)
├── experiment-logs/                # 実験ログ(評価者用。実験フォルダの外に置く)
├── tools/verify/                   # 画面案の検証ツール(Playwright)
└── research/                       # ルール改訂の根拠にした調査メモ
```

ルールは `rules/` の各ファイルを編集すれば更新できる。SKILL.md は入口なので、ルール本文は書かない。

## 使い方

このディレクトリで Claude Code を起動すると、Skill が読み込まれる。

- 明示的に呼ぶ: `/ui-design-rules <依頼内容>`
- 自然文でも可: 「この要件で画面案を3案作って」など

別のプロジェクトで使う場合は、`.claude/skills/ui-design-rules/` をそのプロジェクトの `.claude/skills/` にコピーするか、全プロジェクト共通にしたければ `~/.claude/skills/` に置く。

## 実験の手順

詳しくは [rules/05-experiment.md](.claude/skills/ui-design-rules/rules/05-experiment.md)。記入例は [experiments/order-list-001/experiment-log.md](experiments/order-list-001/experiment-log.md)。

1. **画面を1つ決め、画面要件と実験ログを用意する。**
   ```sh
   mkdir -p experiments/<実験ID>/screenshots
   cp .claude/skills/ui-design-rules/templates/requirements.md experiments/<実験ID>/requirements.md
   cp .claude/skills/ui-design-rules/templates/experiment-log.md experiment-logs/<実験ID>.md
   ```
   画面要件を埋め、実験ログの「0. 実験設計」を生成前に確定する。
2. **IDE で、実験ログ・調査メモ・ルールのファイルを閉じる。** 開いているファイルの情報は、両方のセッションに伝わる。
3. **Baseline を作る。** 新しいセッションで依頼する。
   > `experiments/<実験ID>/requirements.md` の画面を1案、`experiments/<実験ID>/baseline/index.html` に作ってください。ui-design-rules のSkillは使わないでください。
4. **Rules を作る。** 別の新しいセッションで依頼する。
   > `/ui-design-rules experiments/<実験ID>/requirements.md の画面を、3案作って比較してください。`

   3案が `experiments/<実験ID>/rules/variant-a.html` などにでき、`comparison.md` に比較が出る。
5. **評価する。** 人間の評価を先に書き、その後に Claude の評価を見る。採用案を決める。
6. **修正する。** 両方に同じ指摘を、評価者の言葉のまま出す。点数は「総合 3/5」と書く。採用可能(人間の総合4以上)になるまで、最大5回。
7. **記録する。** 時刻はセッション記録(`~/.claude/projects/<プロジェクト>/<セッションID>.jsonl`)から取れる。修正ごとにコミットする。
8. **別の画面で繰り返す。** 1画面で結論を出さない。

## 注意

- Skill は、ユーザーの承認なしに採用案を本番実装へ統合しない。
- 既存プロジェクトで使う場合、画面案は既存ファイルと分離して置く。
