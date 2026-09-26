# Changelog

このファイルの形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従います。

## [Unreleased]

### Added
- 初回リリース: Markdown の整形表示、Ctrl+ホイールでのズーム、自動再読み込み、ドラッグ＆ドロップ、`.md` の関連付け、ダークモード
- Rust（`mdcore::Plugin`）と TypeScript（`ui/src/plugins`）のプラグインアーキテクチャ
- Markdown エディタ: 編集・保存（改行コードと BOM を維持）・ビューアへの反映、リスト／引用の自動継続、インデント維持、Tab でのインデント、太字／斜体、未保存時の確認
- `settings.json` によるプラグインの有効／無効の切替
- Mermaid による図の描画（図を含む文書を開いたときだけライブラリを読み込む）
- 数式の表示（KaTeX）: `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, ```` ```math ````。`$5と$10` のような金額は数式にしない
- 日本語フォント Noto Sans JP を同梱
- 絵文字フォントをフォント指定に明記し、OS のフォント補完に頼らずカラー絵文字で表示
- UI を TypeScript + React + Tailwind CSS（Vite）で実装
