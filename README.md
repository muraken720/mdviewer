# mdviewer

軽量・高速な Windows 向け Markdown ビューア。
生成AIが書き出した `.md` を、HTML に変換せずそのまま読みやすく表示するためのツールです。

- **軽い**: exe 単体で数 MB（Rust + Tauri 2。描画は OS 標準の WebView2 を使うのでランタイムを同梱しない）
- **速い**: Markdown は Rust（[pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark)）で変換
- **余計なものがない**: 読む・ちょっと直すために毎回使う機能だけ

## 機能

| 機能 | 操作 |
|---|---|
| Markdown を整形表示 | `.md` をダブルクリック / ウィンドウにドロップ / <kbd>Ctrl</kbd>+<kbd>O</kbd> |
| 編集モードに切替 | <kbd>Ctrl</kbd>+<kbd>E</kbd> または右上のボタン（もう一度押すと、編集内容をビューアに反映して表示） |
| 保存 | <kbd>Ctrl</kbd>+<kbd>S</kbd>（元ファイルの改行コード CRLF/LF と BOM を維持）。未保存の間はタイトルに `●` |
| 拡大・縮小 | <kbd>Ctrl</kbd>+ホイール / <kbd>Ctrl</kbd>+<kbd>+</kbd> <kbd>-</kbd>（<kbd>Ctrl</kbd>+<kbd>0</kbd> で 100%）。倍率は次回も維持 |
| 自動再読み込み | ファイルが更新されると表示を自動更新（スクロール位置は維持）。手動は <kbd>F5</kbd>。未保存の編集は上書きしない |
| リンク | `#見出し` は文書内ジャンプ、`other.md` はビューアで開く、`https://` は既定のブラウザで開く |
| ダークモード | OS の設定に追従 |

対応記法: CommonMark + GFM（表、タスクリスト、取り消し線、脚注、`> [!NOTE]` 形式のアラート）、相対パス画像。
Mermaid は既定で無効のプラグインです（[設定](#設定) で有効化）。

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
    "mermaid": true,
    "auto-reload": false
  }
}
```

| プラグイン | 既定 | 内容 |
|---|---|---|
| `mermaid` | 無効 | ```` ```mermaid ```` ブロックを図として描画。ライブラリは図を含む文書を開いたときだけ読み込む |
| `gfm`, `heading-anchors`, `local-images` | 有効 | Markdown の拡張記法、見出しアンカー、相対パス画像 |
| `editor`, `zoom`, `links`, `auto-reload`, `title`, `open-file`, `view` | 有効 | 各 UI 機能 |

設定の変更は次回起動時に反映されます。

### やらないこと

シンタックスハイライト、数式、ライブプレビュー（左右分割）、タブ、ファイルツリー、エクスポートなど。
理由と判断基準は [CONTRIBUTING.md](CONTRIBUTING.md#スコープ方針) を参照してください。

## インストール

[Releases](https://github.com/muraken720/mdviewer/releases) から次のいずれかを取得します。

- `mdviewer_x.y.z_x64-setup.exe` — インストーラ。`.md` / `.markdown` の関連付けを登録します
- `mdviewer.exe` — ポータブル版。任意の場所に置いて使います（関連付けは「プログラムから開く」で手動設定）

動作環境: Windows 10 / 11（WebView2 ランタイム。Windows 11 には標準で入っています）

コマンドラインからも開けます:

```
mdviewer.exe path\to\file.md
```

## 開発

必要なもの: Rust (stable)、Node.js 22 以降（UI テストと Tauri CLI の実行に使用。npm 依存パッケージはありません）

```sh
cargo test --workspace           # Rust テスト
npm test                         # UI テスト（node --test）
cargo run -p mdviewer -- a.md    # 開発実行
npx @tauri-apps/cli@2 build      # リリースビルド + インストーラ作成（Windows 上で実行）
```

Linux で開発する場合は Tauri の [前提パッケージ](https://tauri.app/start/prerequisites/)（`libwebkit2gtk-4.1-dev` など）が必要です。

- 構成と設計: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- プラグインの作り方: [docs/PLUGINS.md](docs/PLUGINS.md)
- コントリビュート: [CONTRIBUTING.md](CONTRIBUTING.md)

## ライセンス

[MIT](LICENSE)

同梱しているサードパーティ製ソフトウェア: [Mermaid](https://github.com/mermaid-js/mermaid) 11.17.2（MIT, `ui/vendor/mermaid/LICENSE`）
