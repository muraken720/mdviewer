# アーキテクチャ

## 設計方針

1. **軽量・高速が最優先** — 依存を増やす前に「本当に毎回使うか」を問う。重いライブラリは必要になるまで読み込まない。
2. **ロジックは画面から切り離す** — Markdown の処理は `mdcore`（Tauri に依存しない Rust）、UI の状態管理と編集ロジックは `ui/src/core` と `ui/src/lib`（React・DOM・Tauri に依存しない TypeScript）に置く。どちらも単体でテストできるようにする。
3. **機能はプラグインとして足し引きする** — 各機能を独立したプラグインにし、登録箇所 1 行で追加でき、`settings.json` で無効化できるようにする。
4. **プラグインはビルド時に組み込む** — 実行時にコードを読み込む仕組みは持たない（サイズ・起動速度・安全性のため）。

## 技術構成

| 層 | 技術 | 理由 |
|---|---|---|
| アプリ殻 | Rust + [Tauri 2](https://tauri.app/) | 描画は OS 標準の WebView2 を使うので、ブラウザエンジンを同梱せず小さい |
| Markdown 変換 | Rust + [pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark) | 高速。UI 側に Markdown パーサを持たない |
| UI | TypeScript + React 19 | 型で壊れにくくし、コントリビュータが参加しやすい。プラグインが画面部品を差し込める |
| スタイル | Tailwind CSS v4（アプリの外枠）+ `markdown.css`（本文） | 使ったクラスだけが出力され、実行時コストがない。本文は GitHub の表示に合わせた専用 CSS（Tailwind の `prose` は GitHub と見た目が異なるため） |
| ビルド | Vite | 数式・図のライブラリを別チャンクに分け、必要なときだけ読み込む |
| テスト | `cargo test`、Vitest + Testing Library | |
| フォント | Noto Sans JP（Fontsource の可変ウェイト版） | PC にインストールされていなくても同じ見た目。文字範囲ごとに分割されており、表示に使う分だけ読み込む |

## 全体像

```
┌──────────────────────────────── mdviewer.exe ────────────────────────────────┐
│                                                                               │
│  WebView2（ui/ → Vite でビルドした ui/dist を埋め込み）   Rust（src-tauri/）     │
│  ┌──────────────────────────────────────┐   IPC    ┌────────────────────────┐ │
│  │ main.tsx                             │ ───────▶ │ commands.rs            │ │
│  │  ├ core/app.ts   App（状態・イベント・  │  invoke  │  load / render / save /│ │
│  │  │               コマンド・プラグイン管理）│          │  mtime / settings /    │ │
│  │  ├ components/Shell.tsx（画面の枠）    │ ◀─────── │  ask / pick_file /     │ │
│  │  ├ backend/tauri.ts（Tauri 呼び出し）   │   Doc    │  open_url              │ │
│  │  └ plugins/                           │          │ settings.rs            │ │
│  │     view · editor · title · open-file │          │ platform.rs（OS 依存）  │ │
│  │     links · zoom · auto-reload        │          └───────────┬────────────┘ │
│  │     math（KaTeX, 遅延読込）             │                      │              │
│  │     mermaid（Mermaid, 遅延読込）        │          ┌───────────▼────────────┐ │
│  │  lib/markdown-edit.ts（編集操作）       │          │ crates/mdcore          │ │
│  └──────────────────────────────────────┘          │  Renderer ─ Plugin     │ │
│                                                    │  Gfm · HeadingAnchors · │ │
│                                                    │  LocalImages · Math     │ │
│                                                    │  document · paths · url │ │
│                                                    └────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

## ディレクトリ

| パス | 役割 |
|---|---|
| `crates/mdcore/` | Markdown → HTML パイプライン（`Renderer` / `Plugin`）、組み込みプラグイン、パス・URL 処理、ファイルの読み書き（改行コードと BOM の維持）。依存は pulldown-cmark のみ |
| `src-tauri/src/main.rs` | 起動、設定の読み込み、Markdown プラグインの登録（`renderer()`） |
| `src-tauri/src/commands.rs` | UI から呼ぶ IPC コマンド。薄く保ち、処理は `mdcore` に任せる |
| `src-tauri/src/settings.rs` / `platform.rs` | `settings.json` の読み込み / OS 依存の処理 |
| `ui/src/core/` | `App`（状態・イベント・コマンドとキーマップ・プラグイン管理）と型定義。React・DOM に依存しない |
| `ui/src/lib/markdown-edit.ts` | エディタの編集操作。純粋関数 |
| `ui/src/backend/tauri.ts` | `Backend` インターフェースの Tauri 実装 |
| `ui/src/components/` | 画面の枠（`Shell`）と共通部品 |
| `ui/src/plugins/` | UI の機能。`index.ts` が登録一覧 |
| `ui/src/styles/` | `app.css`（Tailwind・テーマ色・フォント）、`markdown.css`（本文） |
| `ui/src/test/` | テスト用の偽 Backend |

テストは対象ファイルと同じ場所に `*.test.ts(x)` として置きます。

## UI の仕組み

- **状態は `App` が一元管理する**：開いている文書（`doc`）、モード（`view` / `edit`）、未保存フラグ（`dirty`）、エラー。状態が変わると必ずイベントを発行する
- **React との接続**：`App.subscribe` / `App.getVersion` を `useSyncExternalStore` に渡し（`useAppVersion`）、イベントごとに再描画する。状態を React 側に複製しない
- **画面はプラグインが差し込む**：`Shell` は、プラグインが `addPane(mode, Component)` で登録した画面（表示・編集）と、`addOverlay(Component)` で登録した重ね表示（切替ボタン、倍率表示、通知）を並べるだけ
- **本文の後処理**：`view` プラグインは本文の HTML を差し替えるたびに `view:updated`（本文の要素）を発行する。`links`・`math`・`mermaid` はこれを受けて、リンクのクリック処理・数式の組版・図の描画を行う
- **エディタは非制御の `<textarea>`**：入力ごとに React で再描画せず、ブラウザ標準の元に戻す（Ctrl+Z）の履歴を保つため。自動編集は `document.execCommand('insertText')` で適用する

## 処理の流れ

### ファイルを開く

1. `open-file` プラグインが、起動引数・ドロップ・<kbd>Ctrl</kbd>+<kbd>O</kbd> のいずれかからパスを受け取り、`app.open(path)` を呼ぶ
2. `App` が `backend.load()`、つまり IPC の `load` を呼ぶ
3. `commands::load` が `Document::read` で読み込み、`Renderer::render` で HTML に変換する
4. 変換中に `LocalImages` が参照しているローカル画像を集める。`load` は、そのファイルだけをアセットプロトコルで読めるよう許可する
5. `Doc { path, name, raw, html, mtime }` を返す。`App` が `doc:loaded` を発行する
6. `view` が本文を描画し、`view:updated` を発行する。数式や図があれば、このとき初めて KaTeX / Mermaid を読み込む
7. `auto-reload` は 1 秒ごとに更新日時（`mtime`）を比べ、変わっていれば `app.reload()` を呼ぶ（未保存の編集がある間は呼ばない）

### 編集して保存する

```
editor (textarea) ──input──▶ app.update(text) ──▶ doc:dirty ──▶ タイトルに ●
      Ctrl+S ──▶ app.save() ──▶ IPC save ──▶ document::save（元の CRLF/BOM で書き込み）──▶ doc:saved
      Ctrl+E ──▶ app.setMode('view') ──▶ app.refresh() ──▶ IPC render ──▶ doc:rendered ──▶ view
```

- 未保存の編集は失わない：
  - 別ファイルを開く・<kbd>F5</kbd>・ウィンドウを閉じるときは `app.confirmDiscard()` で確認する
  - 保存時にファイルが外部で変更されていれば、上書きしてよいか確認する

### 数式

1. Rust の `Math` プラグインが、構文解析の前（`preprocess`）に書き方を揃える
   - `\(…\)` を `$…$` に、`\[…\]` を `$$…$$` に変換する（コードの中は対象外）
   - 対にならない `$`（`$5と$10` など）はエスケープし、文字として表示されるようにする
2. pulldown-cmark が `<span class="math math-inline|math-display">` を出力する
3. UI の `math` プラグインが KaTeX で組版する。```` ```math ```` ブロックも独立した数式として扱う

## 2 種類のプラグイン

| | Markdown プラグイン（Rust） | UI プラグイン（TypeScript） |
|---|---|---|
| 目的 | Markdown の解釈・HTML の生成を変える | 操作・表示を変える |
| 実体 | `mdcore::Plugin` trait の実装（`preprocess` / `parser_options` / `transform`） | `{ name, setup(app) }` を default export するモジュール |
| 登録 | `src-tauri/src/main.rs` の `renderer()` | `ui/src/plugins/index.ts` |
| 例 | `gfm`, `heading-anchors`, `local-images`, `math` | `view`, `editor`, `title`, `open-file`, `links`, `zoom`, `auto-reload`, `math`, `mermaid` |

`settings.json` の `plugins` は、Rust と UI で共通の名前空間です。同じ名前のプラグインは一緒に切り替わります。たとえば `"math": false` にすると、Rust 側の数式の解釈と UI 側の組版が両方とも無効になります。

作り方は [PLUGINS.md](PLUGINS.md) を参照してください。

## セキュリティ

Markdown には生の HTML を書けるため、文書は信頼できないものとして扱います。

- **CSP** `script-src 'self'`：文書内の `<script>` や `onerror=` などのインラインのイベントハンドラは実行されない
  - Vite の設定で `assetsInlineLimit: 0` とし、`data:` URI を生成しない
  - KaTeX と Mermaid は `eval` を使わない
- **Mermaid**：`securityLevel: 'strict'` で描画する
- **アセットスコープ**：あらかじめ許可しているファイルはない。開いた文書が参照している画像ファイルだけを個別に許可する
- **外部リンク**：`open_url` は `http(s):` と `mailto:` 以外を拒否する（Rust 側で検証）。`javascript:` や `file:` のリンクは UI 側で無視する

## サイズと速度

| 項目 | 目安 |
|---|---|
| exe 全体 | 約 11 MB |
| うち Noto Sans JP | 約 5.3 MB（woff2 は圧縮済みで、それ以上縮まない） |
| 起動時に読み込む JS | 約 250 KB（gzip 約 80 KB。React を含む） |
| KaTeX / Mermaid | 数式・図を含む文書を開いたときだけ読み込む |

- Tauri は埋め込むフロントエンドを Brotli で圧縮する
- KaTeX のフォントは woff2 だけを同梱する（Vite の設定で woff と ttf を除外）
- リリースビルドの Rust の設定：`opt-level = "s"`、LTO、`codegen-units = 1`、`panic = "abort"`、`strip`
- サイズを抑える余地：フォントを同梱せず PC にインストールされたものを使えば、約 5 MB 減らせる
