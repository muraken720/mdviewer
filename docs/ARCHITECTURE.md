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
┌──────────────────────────────── mdviewer.exe ─────────────────────────────────┐
│                                                                                │
│  WebView2（ui/ → Vite でビルドした ui/dist を埋め込み）    Rust（src-tauri/）     │
│  ┌───────────────────────────────────────┐   IPC    ┌─────────────────────────┐ │
│  │ main.tsx                              │ ───────▶ │ commands.rs             │ │
│  │  ├ core/  App（タブ・履歴・イベント・     │  invoke  │  open / open_link /     │ │
│  │  │        コマンド・メニュー・プラグイン） │  (文書ID) │  reload / render / save │ │
│  │  ├ i18n/  日英の辞書・言語の判定        │ ◀─────── │  mtime / close_doc /    │ │
│  │  ├ components/ Shell・MenuBar・TabBar │   Doc    │  app_info / ask / …     │ │
│  │  ├ backend/tauri.ts                   │          │ session.rs（文書ID・権限） │ │
│  │  └ plugins/                           │          │ error.rs（エラーコード）   │ │
│  │     menu · tabs · view · editor ·     │          │ navigation.rs           │ │
│  │     find · help · language · links ·  │          │ single-instance（2つ目の │ │
│  │     zoom · title · open-file ·        │          │  起動をタブで開く）        │ │
│  │     auto-reload · math · mermaid      │          └────────────┬────────────┘ │
│  │  lib/ markdown-edit · find · sanitize │          ┌────────────▼────────────┐ │
│  └───────────────────────────────────────┘          │ crates/mdcore           │ │
│                                                     │  Renderer ─ Plugin      │ │
│                                                     │  Gfm · HeadingAnchors · │ │
│                                                     │  LocalImages · Math     │ │
│                                                     └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

## ディレクトリ

| パス | 役割 |
|---|---|
| `crates/mdcore/` | Markdown → HTML パイプライン（`Renderer` / `Plugin`）、組み込みプラグイン、パス・URL 処理、ファイルの読み書き（改行コードと BOM の維持）。依存は pulldown-cmark のみ |
| `src-tauri/src/main.rs` | 起動、設定の読み込み、Markdown プラグインの登録（`renderer()`） |
| `src-tauri/src/commands.rs` | UI から呼ぶ IPC コマンド。薄く保ち、処理は `mdcore` に任せる |
| `src-tauri/src/session.rs` | 開いてよいファイルと、開いた文書（文書 ID）の管理。画面側に任意のパスを読み書きさせない |
| `src-tauri/src/error.rs` | IPC のエラー（`{ code, detail }`）。画面側で翻訳して表示する |
| `src-tauri/src/navigation.rs` | アプリ以外の URL へのページ移動を拒否する |
| `src-tauri/src/settings.rs` / `platform.rs` | `settings.json` の読み込み / OS 依存の処理 |
| `ui/src/core/` | `App`（タブ・履歴・イベント・コマンドとキーマップ・メニュー・プラグイン管理）、`Tab`、型定義。React・DOM に依存しない |
| `ui/src/i18n/` | 日本語・英語の辞書（キーの一致を型で検査）、OS の言語の判定、切り替え |
| `ui/src/lib/markdown-edit.ts` | エディタの編集操作。純粋関数 |
| `ui/src/lib/sanitize.ts` | 表示前の HTML の無害化（DOMPurify） |
| `ui/src/lib/find.ts` | 文書内検索（要素をまたぐ一致も DOM の Range に変換） |
| `ui/src/backend/tauri.ts` | `Backend` インターフェースの Tauri 実装 |
| `ui/src/components/` | 画面の枠（`Shell`）、`MenuBar`、`TabBar`、`Dialog` などの部品 |
| `ui/src/plugins/` | UI の機能。`index.ts` が登録一覧 |
| `ui/src/styles/` | `app.css`（Tailwind・テーマ色・フォント）、`markdown.css`（本文） |
| `ui/src/test/` | テスト用の偽 Backend |

テストは対象ファイルと同じ場所に `*.test.ts(x)` として置きます。

## UI の仕組み

- **状態は `App` が一元管理する**：タブの一覧とアクティブなタブ。タブ（`Tab`）ごとに、文書（`doc`）、モード（`view` / `edit`）、未保存フラグ（`dirty`）、戻る／進むの履歴、スクロール位置を持つ。`app.doc` などはアクティブなタブの値。状態が変わると必ずイベントを発行する
- **React との接続**：`App.subscribe` / `App.getVersion` を `useSyncExternalStore` に渡し（`useAppVersion`）、イベントごとに再描画する。状態を React 側に複製しない
- **画面はプラグインが差し込む**：`Shell` は次を並べるだけ
  - `addBar` で登録した上部のバー（メニューバー、タブバー）
  - タブごとのパネル。中に `addPane(mode, Component)` で登録した画面（表示・編集）を置き、アクティブなタブのそのモードの画面だけを表示する
  - `addOverlay` で登録した重ね表示（切替ボタン、検索バー、倍率表示、ダイアログ、通知）
- **タブは非表示でも残す**：タブごとの画面を消さずに隠すだけにして、エディタの元に戻す履歴や描画済みの図を保つ。スクロールはタブの画面ごとに独立していて、位置は `Tab.scroll` に記録し、表示し直すときや履歴で戻ったときに復元する
- **メニューはコマンドから組み立てる**：各プラグインが `addMenuItem` で自分のコマンドをメニューに置く。表示名は `title`（メッセージのキー）、ショートカットは `keys` から作るので、メニュー・ヘルプ・起動画面の表示がずれない
- **多言語化**：画面の文字列はすべて `app.t(key)` で辞書から引く。言語は OS の設定（`navigator.languages`）から自動で選び、「表示」メニューで切り替えると `lang:changed` で全体が再描画される
- **本文の後処理**：`view` プラグインは本文の HTML を差し替えるたびに `view:updated`（本文の要素）を発行する。`links`・`math`・`mermaid` はこれを受けて、リンクのクリック処理・数式の組版・図の描画を行う
- **エディタは非制御の `<textarea>`**：入力ごとに React で再描画せず、ブラウザ標準の元に戻す（Ctrl+Z）の履歴を保つため。自動編集は `document.execCommand('insertText')` で適用する

## 処理の流れ

### ファイルを開く

1. ユーザーがファイルを選ぶ（起動引数・<kbd>Ctrl</kbd>+<kbd>O</kbd>・ドロップ・起動中に別の `.md` をダブルクリック）。Rust 側がそのパスを「開いてよいファイル」として `Session` に登録する。ドロップと2つ目の起動では、Rust が `open-request` イベントで画面側に知らせる（2つ目の起動は single-instance プラグインが受け取り、そのプロセスはすぐ終了する）
2. `open-file` プラグインが `app.open(path)` を呼ぶ。すでに開いていればそのタブに切り替え、そうでなければ IPC の `open` を呼び、空のタブか新しいタブに表示する
3. Rust が、許可されたファイルかを確認し、`Document::read` で読み込み、`Renderer::render` で HTML に変換して、**文書 ID** を発行する。以降の再読み込み・描画・保存・更新確認は、画面側が文書 ID を渡して行う
4. 変換中に `LocalImages` が、相対パスで参照されている画像ファイルを集める。Rust は、そのファイルだけをアセットプロトコルで読めるよう許可する
5. `Doc { id, path, name, raw, html, mtime }` を返す。`App` が `doc:loaded` を発行する
6. `view` が HTML を無害化してから描画し、`view:updated` を発行する。数式や図があれば、このとき初めて KaTeX / Mermaid を読み込む
7. `auto-reload` は 1 秒ごとに、アクティブなタブの更新日時（`mtime`）を比べ、変わっていれば再読み込みする（未保存の編集がある間は呼ばない）。別のタブに切り替えたときも、すぐに確認する

### リンクと戻る／進む

- 文書内の相対リンクは `app.openLink(href)` で**同じタブ**に開く。Rust は、そのタブの文書 ID を基準に相対パスを解決する
- 開く前に、今のページ（パスとスクロール位置）をタブの「戻る」履歴に積み、「進む」履歴を空にする
- 「戻る」「進む」は、履歴のパスを IPC の `open` で開き直す（一度開いた文書は開く許可が残っている）。スクロール位置も戻す
- ページを離れた文書の ID は `close_doc` で Rust 側から解放する

### 編集して保存する

```
editor (textarea) ──input──▶ app.update(text) ──▶ doc:dirty ──▶ タイトルに ●
      Ctrl+S ──▶ app.save() ──▶ IPC save（文書 ID。保存先のパスは Rust が持つ）──▶ document::save（元の CRLF/BOM で書き込み）──▶ doc:saved
      Ctrl+E ──▶ app.setMode('view') ──▶ app.refresh() ──▶ IPC render ──▶ doc:rendered ──▶ view
```

- 未保存の編集は失わない：
  - リンクで移動する・戻る・<kbd>F5</kbd>・タブを閉じるときは `app.confirmDiscard()` で確認する
  - ウィンドウを閉じるとき（×ボタン、Alt+F4、「ファイル → 終了」）は、未保存のタブがあれば `app.confirmExit()` で1回だけ確認する
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
| 例 | `gfm`, `heading-anchors`, `local-images`, `math` | `menu`, `tabs`, `view`, `editor`, `find`, `help`, `language`, `title`, `open-file`, `links`, `zoom`, `auto-reload`, `math`, `mermaid` |

`settings.json` の `plugins` は、Rust と UI で共通の名前空間です。同じ名前のプラグインは一緒に切り替わります。たとえば `"math": false` にすると、Rust 側の数式の解釈と UI 側の組版が両方とも無効になります。

作り方は [PLUGINS.md](PLUGINS.md) を参照してください。

## セキュリティ

Markdown には生の HTML を書けるため、文書は信頼できないものとして扱います。脅威モデルと対策の一覧は [SECURITY.md](../SECURITY.md) にあります。設計上の要点は次のとおりです。

- **WebView（画面側）を信頼しない**
  - ファイルの読み書きは Rust の `Session` が管理する
  - 画面側が渡せるのは、ユーザーが選んだファイルのパスと、文書内のリンク文字列（相対パス）だけ
  - 保存・再読み込み・更新日時の確認は、Rust が発行した文書 ID で行う。画面側からパスを指定して書き込むことはできない
- **文書由来のパスは `mdcore::paths::resolve_relative` だけで解決する**
  - 普通の相対パス以外（絶対パス、ドライブ指定、UNC パス、URL）は拒否する
  - 画像として読み込みを許可するのは、画像の拡張子を持つファイルだけ
- **多層防御**
  - CSP：`script-src 'self'`、`object-src` / `frame-src` / `base-uri` / `form-action` は `'none'`
  - DOMPurify による HTML の無害化
  - Rust 側のページ移動の禁止（`navigation.rs`）
  - Vite の設定で `data:` URI を生成しない（`assetsInlineLimit: 0`）
- **外部リンク**：`mdcore::url::is_web_url` で検証した `http(s):` と `mailto:` の URL だけを、Tauri の opener プラグインで既定のブラウザに渡す

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
