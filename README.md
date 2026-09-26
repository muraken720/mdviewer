# mdviewer

[![CI](https://github.com/muraken720/mdviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/muraken720/mdviewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

軽量・高速な Windows 向け Markdown ビューア／エディタ。
生成AIが書き出した `.md` を、HTML に変換せずそのまま読みやすく表示し、その場で直すためのツールです。

- **軽い**: exe 単体で約 11 MB、うち約 5 MB は日本語フォント（Noto Sans JP）。描画には OS 標準の WebView2 を使うので、ブラウザエンジンは同梱しない（Rust + Tauri 2）
- **速い**: Markdown は Rust（[pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark)）で変換
- **余計なものがない**: 読む・ちょっと直すために毎回使う機能だけ

## English

mdviewer is a small, fast Markdown viewer/editor for Windows, made for reading the Markdown that AI tools produce without converting it to HTML first.
It renders GitHub Flavored Markdown, math (KaTeX: `$…$`, `$$…$$`, `\(…\)`, `\[…\]`) and Mermaid diagrams, has a minimal editor with list continuation, and auto-reloads when the file changes.
Built with Rust + Tauri 2 (WebView2) and TypeScript + React. Documentation is in Japanese; issues and pull requests in English are welcome.

## 機能

| 機能 | 操作 |
|---|---|
| Markdown を整形表示 | `.md` をダブルクリック / ウィンドウにドロップ / <kbd>Ctrl</kbd>+<kbd>O</kbd> |
| タブ | 別のファイルは新しいタブで開く（起動中に別の `.md` をダブルクリックしても同じウィンドウのタブに開く）。<kbd>Ctrl</kbd>+<kbd>Tab</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> で切替、<kbd>Ctrl</kbd>+<kbd>W</kbd> で閉じる |
| 戻る・進む | 文書内のリンクで開いた文書は同じタブに開き、<kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd>、タブバー左のボタン、マウスの戻る／進むボタン、「移動」メニューで行き来できる（スクロール位置も戻る） |
| 検索 | <kbd>Ctrl</kbd>+<kbd>F</kbd>。一致箇所をハイライトし件数を表示。<kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd>（または <kbd>F3</kbd> / <kbd>Shift</kbd>+<kbd>F3</kbd>）で次／前へ |
| メニュー | ファイル・編集・表示・移動・ヘルプ。<kbd>Alt</kbd> または <kbd>F10</kbd> でメニューへ移動、<kbd>Alt</kbd>+<kbd>F</kbd> などで直接開く |
| 言語 | メニューは日本語と英語。OS の言語設定に合わせて自動で選び、「表示」メニューで切り替えられる（選択は次回も維持） |
| ヘルプ | <kbd>F1</kbd> でショートカット一覧。「ヘルプ → mdviewer について」でバージョン・作者・ライセンス |
| 編集モードに切替 | <kbd>Ctrl</kbd>+<kbd>E</kbd> または右上のボタン（もう一度押すと、編集内容をビューアに反映して表示） |
| 保存 | <kbd>Ctrl</kbd>+<kbd>S</kbd>（元ファイルの改行コード CRLF/LF と BOM を維持）。未保存の間はタイトルに `●` |
| 拡大・縮小 | <kbd>Ctrl</kbd>+ホイール / <kbd>Ctrl</kbd>+<kbd>+</kbd> <kbd>-</kbd>（<kbd>Ctrl</kbd>+<kbd>0</kbd> で 100%）。倍率は次回も維持 |
| 自動再読み込み | ファイルが更新されると表示を自動更新（スクロール位置は維持）。手動は <kbd>F5</kbd>。未保存の編集は上書きしない |
| リンク | `#見出し` は文書内ジャンプ、`other.md` はビューアで開く、`https://` は既定のブラウザで開く |
| ダークモード | OS の設定に追従 |
| 日本語フォント | Noto Sans JP を同梱（PC にインストールされていなくても同じ見た目） |
| 絵文字 | ✅ ⚠️ 🚀 などをカラーで表示（Windows では Segoe UI Emoji）。国旗の絵文字は Windows の制約で文字（`JP` など）になる。`:rocket:` のようなショートコードは変換しない |

対応記法: CommonMark + GFM（表、タスクリスト、取り消し線、脚注、`> [!NOTE]` 形式のアラート）、画像、数式、図。

画像は、文書からの相対パス（`![](img/a.png)` など）と https の URL を表示します。安全のため、絶対パス（`C:\...`）やネットワーク共有（`\\server\...`）の画像、リンク先は開きません（[SECURITY.md](SECURITY.md)）。

### 数式（TeX / LaTeX）

[KaTeX](https://katex.org/) で描画します。次の書き方に対応しています。

| 書き方 | 種類 |
|---|---|
| `$E = mc^2$`、`\(E = mc^2\)` | 文中の数式 |
| `$$ … $$`、`\[ … \]`、```` ```math ```` ブロック | 独立した数式 |

- `\(…\)` と `\[…\]` は ChatGPT などの生成AIがよく出力する LaTeX 形式です
- `$5と$10` のような金額は数式になりません（Pandoc と同じく、閉じ側の `$` の直前が空白、または直後が数字の場合は数式として扱わない）。確実に `$` を表示したいときは `\$` と書きます
- `\[1\]` のように、中身が数式らしくない `\[…\]` は、Markdown のエスケープ（角括弧そのもの）として表示します
- コード（`` ` `` や ```` ``` ````）の中は変換しません
- `.tex` ファイル（LaTeX 文書全体）の組版には対応していません

### 図（Mermaid）

```` ```mermaid ```` ブロックを図として描画します（[Mermaid](https://mermaid.js.org/) 11）。

### エディタ

| 操作 | 動作 |
|---|---|
| <kbd>Enter</kbd> | インデントを維持。箇条書き・番号付きリスト（番号は自動で +1）・タスクリスト・引用を継続。空の項目で押すとリストを抜ける（ネストしていれば 1 段戻る） |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | リスト項目や選択行をインデント／アウトデント |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>Ctrl</kbd>+<kbd>I</kbd> | 太字／斜体の切替 |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | 元に戻す／やり直し（上記の自動編集も含む） |

コードブロック（```` ``` ````）の中ではリストの自動継続は行わず、インデントだけを維持します。日本語入力の変換確定の <kbd>Enter</kbd> には反応しません。
未保存のまま閉じる・別ファイルを開く・<kbd>F5</kbd> を押したときは確認します。

## 設定

設定ファイルで、プラグインごとに有効／無効を切り替えられます。ファイルがなければすべて既定値です。

- Windows: `%APPDATA%\io.github.muraken720.mdviewer\settings.json`
- Linux: `~/.config/io.github.muraken720.mdviewer/settings.json`

```json
{
  "plugins": {
    "mermaid": false,
    "auto-reload": false
  }
}
```

| プラグイン | 既定 | 内容 |
|---|---|---|
| `math` | 有効 | 数式。KaTeX は数式を含む文書を開いたときだけ読み込む |
| `mermaid` | 有効 | ```` ```mermaid ```` ブロックを図として描画。ライブラリは図を含む文書を開いたときだけ読み込む |
| `gfm`, `heading-anchors`, `local-images` | 有効 | Markdown の拡張記法、見出しアンカー、相対パス画像 |
| `menu`, `tabs`, `view`, `editor`, `find`, `language`, `help`, `zoom`, `links`, `auto-reload`, `title`, `open-file` | 有効 | 各 UI 機能 |

設定の変更は次回起動時に反映されます。

### やらないこと

シンタックスハイライト、ライブプレビュー（左右分割）、ファイルツリー、セッションの復元、エクスポートなど。
理由と判断基準は [CONTRIBUTING.md](CONTRIBUTING.md#スコープ方針) を参照してください。

## インストール

[Releases](https://github.com/muraken720/mdviewer/releases) から次のいずれかを取得します。

- `mdviewer_x.y.z_x64-setup.exe` — インストーラ。`.md` / `.markdown` の関連付けを登録します
- `mdviewer_x.y.z_x64_portable.zip` — ポータブル版。展開した `mdviewer.exe` を任意の場所に置いて使います（関連付けは「プログラムから開く」で手動設定）

どちらにも、ライセンス（`LICENSE.txt`）と、利用しているオープンソースソフトウェアのライセンス全文（`THIRD_PARTY_LICENSES.md`）が含まれます。

動作環境: Windows 10 / 11（WebView2 ランタイム。Windows 11 には標準で入っています）

> [!NOTE]
> 実行ファイルにはコード署名をしていないため、初回起動時に「Windows によって PC が保護されました」（SmartScreen）と表示されることがあります。
> 「詳細情報」→「実行」で起動できます。不安な場合は、[Releases](https://github.com/muraken720/mdviewer/releases) のファイルであることを確認してください。

コマンドラインからも開けます:

```
mdviewer.exe path\to\file.md
```

## 開発

必要なもの: Rust (stable)、Node.js 22 以降

UI は TypeScript + React + Tailwind CSS（Vite でビルド）、Markdown の変換は Rust です。

```sh
npm ci                           # 依存パッケージのインストール
npm run tauri dev                # 開発実行（UI はホットリロード）
npm test                         # UI テスト（Vitest）
npm run lint                     # Lint + フォーマット確認（Biome）
npm run typecheck                # 型チェック
cargo test --workspace           # Rust テスト（先に npm run build が必要）
npm run tauri build              # リリースビルド + インストーラ作成（Windows 上で実行）
```

Linux で開発する場合は Tauri の [前提パッケージ](https://tauri.app/start/prerequisites/)（`libwebkit2gtk-4.1-dev` など）が必要です。

- 構成と設計: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- プラグインの作り方: [docs/PLUGINS.md](docs/PLUGINS.md)
- コントリビュート: [CONTRIBUTING.md](CONTRIBUTING.md)
- セキュリティ: [SECURITY.md](SECURITY.md)

## ライセンス

[MIT](LICENSE)

mdviewer は多くのオープンソースソフトウェアに支えられています。作者とコントリビュータの皆さんに感謝します。
主なプロジェクトの紹介は [docs/ACKNOWLEDGEMENTS.md](docs/ACKNOWLEDGEMENTS.md)、配布物に含まれるすべてのソフトウェアのライセンス全文は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) にあります。

主な同梱ソフトウェア:

| ソフトウェア | ライセンス |
|---|---|
| [React](https://react.dev/) | MIT |
| [KaTeX](https://katex.org/)（フォントを含む） | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Apache-2.0 または MPL-2.0 |
| [Mermaid](https://mermaid.js.org/) | MIT |
| [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（[Fontsource](https://fontsource.org/)） | SIL Open Font License 1.1 |
