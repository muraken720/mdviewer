# コントリビュートガイド

Issue・Pull Request を歓迎します。大きな変更は、先に Issue で相談してください。

## スコープ方針

mdviewer の価値は **「必要十分で、余計な機能がない」** ことです。機能追加は次の基準で判断します。

採用するもの:
- Markdown を **読む・ちょっと直す** ときに、ほぼ毎回使うもの
- 追加してもサイズ・起動時間への影響が無視できるもの（目安: exe +100 KB 以内、新しい重い依存なし）

重いが需要の大きいものは、**必要になるまで読み込まない（遅延読み込み）** ことを条件に採用を検討します。起動時間を増やさないことが前提で、exe サイズの増加は README に明記します。
例: Mermaid（exe +約 0.9 MB。図を含む文書を開いたときだけ読み込む）

なお、同梱したファイルはプラグインを無効にしても exe に含まれます。「既定で無効」はサイズ対策にならないため、サイズを理由に既定で無効にはしません。

採用しないもの（現時点での判断）:

| 機能 | 理由 |
|---|---|
| シンタックスハイライト | 言語定義が重い。コードは等幅＋背景色で十分読める |
| 数式 | JS ライブラリが重い。需要が確認できれば Mermaid と同じく遅延読み込みで検討 |
| リッチなエディタ（CodeMirror 等）、ライブプレビュー | `textarea` + Markdown 用の編集操作で十分。依存とビルド工程を増やさない |
| タブ・ファイルツリー・履歴 | ファイルごとにウィンドウを開けば足りる |
| 実行時プラグイン | サイズ・起動速度・安全性とトレードオフになる |

## 開発環境

- Rust stable、Node.js 22 以降
- Linux の場合は Tauri の前提パッケージ（`libwebkit2gtk-4.1-dev` など）

## 変更を出す前のチェック

CI と同じ内容です。

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm test
```

## 規約

- ロジックを追加するときはテストも書く。Rust は同じファイルの `#[cfg(test)]`、UI は `tests/ui/*.test.js`
- `src-tauri/src/commands.rs` は薄く保つ。処理は `mdcore` に置く
- UI は素の ES Modules で書く。npm の実行時依存・ビルド工程は追加しない
- サードパーティのライブラリを同梱するときは `ui/vendor/<name>/` にライセンスファイルと一緒に置き、README に記載する
- ユーザーに見える変更は `CHANGELOG.md` の `Unreleased` に追記する

## リリース

1. `Cargo.toml`（`workspace.package.version`）と `src-tauri/tauri.conf.json` のバージョンを上げる
2. `CHANGELOG.md` を更新する
3. `vX.Y.Z` タグを push すると、GitHub Actions が Windows 版をビルドしてドラフトリリースを作る
