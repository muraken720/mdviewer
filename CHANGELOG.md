# Changelog

このファイルの形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従います。
各バージョンの節は、そのままリリースノートとして使われます（`.github/workflows/release.yml`）。

## [Unreleased]

## [0.1.0] - 2026-09-26

最初のリリースです。生成AIが書き出した Markdown を、HTML に変換せずにそのまま読み、必要ならその場で直すための Windows 向けビューア／エディタです。

### 表示
- CommonMark + GFM（表、タスクリスト、取り消し線、脚注、`> [!NOTE]` 形式のアラート）、相対パスの画像
- 数式（KaTeX）：`$…$`、`$$…$$`、`\(…\)`、`\[…\]`、```` ```math ````。`$5と$10` のような金額は数式にしない
- 図（Mermaid）：```` ```mermaid ````
- 日本語フォント Noto Sans JP を同梱、カラー絵文字、ダークモード（OS に追従）
- Ctrl+ホイールでの拡大・縮小（倍率は次回も維持）、ファイル更新時の自動再読み込み
- リンク：`#見出し` は文書内ジャンプ、相対パスの `.md` はビューアで開く、`https://` は既定のブラウザで開く

### 編集
- Ctrl+E で表示と編集を切り替え、Ctrl+S で保存（元の改行コード CRLF/LF と BOM を維持）
- リスト・番号付きリスト・タスクリスト・引用の自動継続、インデント維持、Tab / Shift+Tab、Ctrl+B / Ctrl+I
- 未保存の変更を守る：自動再読み込みで上書きしない。開き直す・閉じるときに確認する

### 安全性
- 信頼できない文書を開く前提で設計（[SECURITY.md](https://github.com/muraken720/mdviewer/blob/main/SECURITY.md)）
- スクリプトは実行しない（CSP と DOMPurify）。アプリ以外へのページ移動を禁止する
- 文書から参照できるのは相対パスのファイルだけ。UNC パス（`\\server\share`）は使えない
- 開けるファイルと保存先は、ユーザーが選んだファイルと現在の文書に限る

### その他
- インストーラ（`.md` の関連付け）とポータブル版 zip
- `settings.json` で機能（プラグイン）ごとに有効／無効を切り替え可能
- 利用している OSS のライセンス全文（`THIRD_PARTY_LICENSES.md`）を同梱

[Unreleased]: https://github.com/muraken720/mdviewer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/muraken720/mdviewer/releases/tag/v0.1.0
