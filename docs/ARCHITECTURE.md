# アーキテクチャ

## 設計方針

1. **軽量が最優先** — 依存を増やす前に「本当に毎回使うか」を問う。フロントエンドはビルド工程なしの素の ES Modules。
2. **ロジックは GUI から切り離す** — Markdown 処理は `mdcore`（Tauri 非依存）、UI ロジックは `ui/core.js`（DOM・Tauri 非依存）に置き、どちらも単体でテストできるようにする。
3. **機能はプラグインとして足し引きする** — 各機能を独立したプラグインにし、登録箇所 1 行で有効化・無効化できるようにする。
4. **プラグインはコンパイル時に組み込む** — 実行時にコードを読み込む仕組みは持たない（サイズ・起動速度・安全性のため）。有効／無効は `settings.json` で切り替える。
5. **重い機能は遅延読み込み** — 既定無効のプラグイン（Mermaid）は、有効かつ必要になったときだけライブラリを読み込む。

## 全体像

```
┌─────────────────────────── mdviewer.exe ───────────────────────────┐
│                                                                      │
│  WebView2 (ui/)                        Rust (src-tauri/)             │
│  ┌──────────────────────────┐  IPC    ┌───────────────────────────┐ │
│  │ main.js                  │ ──────▶ │ commands.rs               │ │
│  │  └ core.js  (App)        │ invoke  │  load / render / save /   │ │
│  │     ├ plugins/view       │         │  mtime / settings / ask / │ │
│  │     ├ plugins/editor ─ lib/markdown-edit.js   pick_file / open_url │ │
│  │     ├ plugins/title      │ ◀────── │ settings.rs (settings.json)│ │
│  │     ├ plugins/open-file  │   Doc   │ platform.rs (OS 依存)      │ │
│  │     ├ plugins/links      │         └─────────────┬─────────────┘ │
│  │     ├ plugins/zoom       │                       │               │
│  │     ├ plugins/auto-reload│         ┌─────────────▼─────────────┐ │
│  │     └ plugins/mermaid ─ vendor/mermaid (遅延読込)  crates/mdcore  │ │
│  │ backend.js (Tauri 呼出)  │         │  Renderer ─ Plugin trait  │ │
│  └──────────────────────────┘         │  ├ Gfm / HeadingAnchors / │ │
│                                       │  │ LocalImages            │ │
│                                       │  └ document / paths / url │ │
│                                       └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## ディレクトリ

| パス | 役割 | 依存 |
|---|---|---|
| `crates/mdcore/` | Markdown → HTML パイプライン、プラグイン、パス／URL 処理、ファイル読み書き（改行コード・BOM の保持） | pulldown-cmark のみ |
| `src-tauri/src/main.rs` | 起動、設定の読込、Markdown プラグインの登録（`renderer()`） | tauri |
| `src-tauri/src/settings.rs` | `settings.json` の読込 | serde_json |
| `src-tauri/src/commands.rs` | UI から呼ぶ IPC コマンド。薄く保ち、処理は `mdcore` に委譲 | |
| `src-tauri/src/platform.rs` | OS 依存処理（ブラウザ起動、アセット URL） | |
| `ui/core.js` | App: 文書と編集の状態、イベントバス、コマンド／キーマップ、プラグインホスト | なし |
| `ui/lib/markdown-edit.js` | Markdown の編集操作（Enter でのリスト継続、インデントなど）。純粋関数 | なし |
| `ui/vendor/` | 同梱ライブラリ（Mermaid）。既定無効のプラグインからのみ読み込む | |
| `ui/backend.js` | `Backend` インターフェースの Tauri 実装 | Tauri JS API |
| `ui/plugins/` | UI 機能。`index.js` が登録一覧 | DOM |
| `tests/ui/` | UI のテスト（`node --test`、偽 Backend を使用） | Node.js |

## 処理の流れ（ファイルを開く）

1. `open-file` プラグインが起動引数／ドロップ／<kbd>Ctrl</kbd>+<kbd>O</kbd> からパスを得て `app.open(path)` を呼ぶ
2. `core.js` が `backend.load()` → IPC `load` を呼ぶ
3. `commands::load` が `Document::read` で読み込み、`Renderer::render` で HTML 化
4. 描画中に `LocalImages` が参照したローカル画像を `Rendered::assets` に集め、`load` がそのファイルだけをアセットプロトコルで読めるよう許可する
5. UI に `Doc { path, name, raw, html, mtime }` を返し、`doc:loaded` イベントを発行
6. `view` プラグインが DOM に反映。`auto-reload` は 1 秒ごとに `mtime` を比較し、変化があれば `app.reload()`

## 処理の流れ（編集して保存する）

```
editor (textarea) ──input──▶ app.update(text) ──▶ doc:dirty ──▶ title に ●
      Ctrl+S ──▶ app.save() ──▶ IPC save ──▶ document::save（元の CRLF/BOM で書込）──▶ doc:saved
      Ctrl+E ──▶ app.setMode('view') ──▶ app.refresh() ──▶ IPC render ──▶ doc:rendered ──▶ view
```

- 状態は `core.js` が一元管理する: `doc.raw`（編集中のテキスト）、保存済みテキスト、最後に描画したテキスト。`app.dirty` は `doc.raw` と保存済みテキストを比べた結果
- ビューアへの反映は、表示モードに戻ったとき、テキストが前回の描画から変わっている場合だけ行う
- 未保存の編集は失わない: 自動再読み込みは dirty の間は止まる。開く・F5・ウィンドウを閉じるときは `app.confirmDiscard()` で確認する。保存時にファイルが外部で変更されていれば、上書きしてよいか確認する
- エディタの自動編集は `document.execCommand('insertText')` で適用し、ブラウザ標準の元に戻す（Ctrl+Z）の履歴に残す

## 設定

`settings.json`（パスは README 参照）を起動時に 1 回読み込みます。

- Rust: `renderer()` が `Renderer::retain` で無効な Markdown プラグインを外す
- UI: `main.js` が `isPluginEnabled(plugin, settings)` で UI プラグインを選んで登録する。プラグインの既定は `enabledByDefault`（省略時 true）

Rust と UI のプラグインは同じ `plugins` マップで名前指定します。名前は重複させないでください。

## 2 種類のプラグイン

| | Markdown プラグイン（Rust） | UI プラグイン（JS） |
|---|---|---|
| 目的 | Markdown の解釈・HTML 生成を変える | 操作・表示を変える |
| 実体 | `mdcore::Plugin` trait の実装 | `{ name, setup(app) }` を default export する ES Module |
| 登録 | `src-tauri/src/main.rs` の `renderer()` | `ui/plugins/index.js` |
| 例 | `Gfm`, `HeadingAnchors`, `LocalImages` | `view`, `editor`, `title`, `zoom`, `links`, `auto-reload`, `open-file`, `mermaid` |
| 既定値 | すべて有効 | `enabledByDefault: false` で既定無効にできる |

作り方は [PLUGINS.md](PLUGINS.md) を参照。

## セキュリティ

Markdown には生の HTML を書けるため、文書を信頼できないものとして扱います。

- **CSP** `script-src 'self'`: 文書内の `<script>` やインライン `onerror=` などは実行されない
- **アセットスコープ**: 静的な許可は空。開いた文書が参照する画像ファイルだけを個別に許可する
- **Mermaid**: `securityLevel: 'strict'` で描画する。ライブラリは `eval` を使わないため CSP を緩めていない
- **外部リンク**: `open_url` は `http(s):` / `mailto:` 以外を拒否する（Rust 側で検証）。`javascript:` や `file:` のリンクは UI 側で無視する
- 実行時にプラグインを読み込む仕組みは持たない

## サイズと速度のために

- リリースプロファイル: `opt-level = "s"`、LTO、`codegen-units = 1`、`panic = "abort"`、`strip`
- フロントエンドにフレームワーク・バンドラ・npm 依存を使わない
- シンタックスハイライトなど重い機能は入れない（[スコープ方針](../CONTRIBUTING.md#スコープ方針)）
- 重い機能（Mermaid）は既定で無効にし、有効な場合も必要になるまで読み込まない
- Tauri は埋め込むフロントエンドを Brotli で圧縮するため、Mermaid（3.5 MB）の exe への影響は約 0.9 MB
