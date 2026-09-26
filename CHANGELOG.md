# Changelog

このファイルの形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従います。

## [Unreleased]

### Added
- 初回リリース: Markdown の整形表示、Ctrl+ホイールでのズーム、自動再読み込み、ドラッグ＆ドロップ、`.md` の関連付け、ダークモード
- Rust（`mdcore::Plugin`）と JS（`ui/plugins`）のプラグインアーキテクチャ
- Markdown エディタ: 編集・保存（改行コードと BOM を維持）・ビューアへの反映、リスト／引用の自動継続、インデント維持、Tab でのインデント、太字／斜体、未保存時の確認
- `settings.json` によるプラグインの有効／無効の切替
- Mermaid プラグイン（既定で無効）
