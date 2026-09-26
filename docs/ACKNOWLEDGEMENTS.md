# 謝辞

mdviewer は、たくさんのオープンソースソフトウェアの上に成り立っています。
小さなアプリでも、軽く、速く、安全に動くのは、これらのプロジェクトの作者とコントリビュータの皆さんが、長い時間をかけて磨き上げた成果を公開してくださっているからです。心から感謝します。

主なプロジェクトと、mdviewer での役割を紹介します。
配布物に含まれるすべてのソフトウェアとライセンス全文は [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md) にあります（インストーラ版はインストール先フォルダ、ポータブル版は zip に同梱）。

## アプリの土台

| プロジェクト | 役割 | ライセンス |
|---|---|---|
| [Tauri](https://tauri.app/) | アプリの外枠。OS 標準の WebView を使い、ブラウザエンジンを同梱せずに小さく作れる | MIT / Apache-2.0 |
| [Rust](https://www.rust-lang.org/) とその標準ライブラリ・エコシステム | Markdown の変換、ファイル操作、安全性の中心 | MIT / Apache-2.0 |
| [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) | Windows での画面の描画（OS に含まれるランタイムを利用し、同梱はしない） | Microsoft のライセンス |

## Markdown・数式・図

| プロジェクト | 役割 | ライセンス |
|---|---|---|
| [pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark) | 高速で正確な CommonMark / GFM パーサ。mdviewer の中核 | MIT |
| [KaTeX](https://katex.org/) | 数式の組版。速く、`eval` を使わない安全な設計 | MIT |
| [Mermaid](https://mermaid.js.org/) | テキストから図を描く。生成AIの文書でよく使われる | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 表示前の HTML の無害化。信頼できない文書を安全に表示する要 | Apache-2.0 / MPL-2.0 |

## 画面

| プロジェクト | 役割 | ライセンス |
|---|---|---|
| [React](https://react.dev/) | 画面の組み立て | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | スタイル（ビルド時に、使うクラスとリセット CSS だけを出力） | MIT |
| [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（Google Fonts） | 本文の日本語フォント。どの PC でも同じ読みやすさを提供 | SIL Open Font License 1.1 |
| [Fontsource](https://fontsource.org/) | Noto Sans JP を文字範囲ごとに分割し、npm で使えるようにしたパッケージ | OFL-1.1 |

## 開発を支えるツール

配布物には含まれませんが、開発に欠かせないツールです。

[Vite](https://vite.dev/)（出力に含まれる小さな補助コードは配布物に含まれます）、[TypeScript](https://www.typescriptlang.org/)、[Vitest](https://vitest.dev/)、[Testing Library](https://testing-library.com/)、[Biome](https://biomejs.dev/)、[cargo-about](https://github.com/EmbarkStudios/cargo-about)、[GitHub Actions](https://github.com/features/actions)

## ライセンスの遵守について

- 配布物（インストーラ・ポータブル版）には、mdviewer 自身の [LICENSE](../LICENSE)（MIT）と、[THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md)（利用しているすべてのソフトウェアの著作権表示とライセンス全文）を同梱しています
- `THIRD_PARTY_LICENSES.md` は、依存関係から `npm run licenses` で自動生成しています。CI で最新であることを確認しているので、依存を更新しても記載が漏れることはありません
- Noto Sans JP は SIL Open Font License 1.1 に従い、改変せずにアプリに同梱しています。フォントの単体販売はしていません
- 記載に誤りや漏れがあれば、Issue でお知らせください。すぐに対応します
