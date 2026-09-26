# コントリビュートガイド

Issue・Pull Request を歓迎します。大きな変更は、先に Issue で相談してください。

## スコープ方針

mdviewer の価値は **「必要十分で、余計な機能がない」** ことです。機能追加は次の基準で判断します。

採用するもの:
- Markdown を **読む・ちょっと直す** ときに、ほぼ毎回使うもの
- 追加してもサイズ・起動時間への影響が無視できるもの（目安: exe +100 KB 以内、新しい重い依存なし）

重いが需要の大きいものは、**必要になるまで読み込まない（遅延読み込み）** ことを条件に採用を検討します。起動時間を増やさないことが前提で、exe サイズの増加は README に明記します。
例: Mermaid・KaTeX（図・数式を含む文書を開いたときだけ `import()` で読み込む）、Noto Sans JP（文字範囲ごとに分割され、使う分だけ読み込む）

なお、同梱したファイルはプラグインを無効にしても exe に含まれます。「既定で無効」はサイズ対策にならないため、サイズを理由に既定で無効にはしません。

採用しないもの（現時点での判断）:

| 機能 | 理由 |
|---|---|
| シンタックスハイライト | 言語定義が重い。コードは等幅＋背景色で十分読める |
| リッチなエディタ（CodeMirror 等）、ライブプレビュー | `textarea` + Markdown 用の編集操作で十分 |
| `.tex` ファイル（LaTeX 文書全体）の組版 | TeX エンジンが必要で、ビューアの範囲を超える。Markdown 内の数式には対応済み |
| タブ・ファイルツリー・履歴 | ファイルごとにウィンドウを開けば足りる |
| 実行時プラグイン | サイズ・起動速度・安全性とトレードオフになる |

## 開発環境

- Rust stable、Node.js 22 以降
- Linux の場合は Tauri の前提パッケージ（`libwebkit2gtk-4.1-dev` など）

```sh
npm ci
npm run tauri dev    # Vite の開発サーバー + アプリ（UI はホットリロード）
```

Rust のビルドは `ui/dist`（UI のビルド結果）を埋め込むため、`cargo build` / `cargo test` / `cargo clippy` の前に一度 `npm run build` を実行してください。
Tauri CLI を使わずに `cargo build` で配布用の exe を作るときは、`--features custom-protocol` が必要です（付けないと開発サーバーを読みに行く exe になります）。

## 変更を出す前のチェック

CI と同じ内容です。

```sh
npm run lint        # 直すときは npm run format
npm run typecheck
npm test
npm run build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## 規約

- ロジックを追加するときはテストも書く。Rust は同じファイルの `#[cfg(test)]`、UI は同じ場所の `*.test.ts(x)`（Vitest）
- `src-tauri/src/commands.rs` は薄く保つ。処理は `mdcore` に置く
- UI の状態とロジックは `ui/src/core` と `ui/src/lib` に置き、React・DOM に依存させない。React の部品には、つなぎ込みと表示だけを書く
- TypeScript は `strict`。`any` は使わない。整形と Lint は Biome（`npm run format` で自動修正）
- **セキュリティ**: WebView（画面側）は信頼しない。ファイルのパスを画面側から受け取って読み書きする IPC を追加しない（`src-tauri/src/session.rs` を通す）。文書由来のパスは `mdcore::paths::resolve_relative` で解決する。詳しくは [SECURITY.md](SECURITY.md)
- スタイルは Tailwind のユーティリティとテーマ色（`text-fg`, `bg-bg` など）で書く。Markdown 本文のスタイルは `ui/src/styles/markdown.css` に書く
- 実行時の依存（`dependencies`）を追加するときは、exe サイズと起動時間への影響を PR に書き、ライセンスを README に記載する
- Tauri は、Rust の `tauri` クレートと npm の `@tauri-apps/api` / `@tauri-apps/cli` を同じマイナーバージョンにそろえる（そろっていないと `tauri build` が失敗する）
- ユーザーに見える変更は `CHANGELOG.md` の `Unreleased` に追記する

## リリース

1. `Cargo.toml`（`workspace.package.version`）と `src-tauri/tauri.conf.json` のバージョンを上げる
2. `CHANGELOG.md` を更新する
3. `vX.Y.Z` タグを push すると、GitHub Actions が Windows 版をビルドしてドラフトリリースを作る
