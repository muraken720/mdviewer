# Changelog

このファイルの形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従います。
各バージョンの節は、そのままリリースノートとして使われます（`.github/workflows/release.yml`）。

各バージョンの節は、英語を先に、日本語を後に書きます（0.2.0 から）。

1. 英語：1〜2 文の要約、`### Added` / `### Changed` / `### Fixed` などの見出しと項目
2. `---` で区切り、`**日本語**` の見出し
3. 日本語：要約、`**追加**` / `**変更**` / `**修正**` などの太字見出しと項目（英語と同じ順）

`Unreleased` にも同じ形で追記します。

## [Unreleased]

## [0.3.0] - 2026-10-01

A table of contents for wide windows, an edit mode that looks like ruled paper, and switching between view and edit that keeps your place.

### Added
- Table of contents at the right of the document in wide windows (1280 px or more): the document title (click to go back to the top), then the level 2 and 3 headings, with the section being read highlighted; click to jump. On by default; View menu → Table of Contents turns it off (remembered). The document itself does not move
- While editing, the status bar shows the cursor line and column
- Switching between view and edit keeps roughly the same place in the document (matched by headings), and the cursor starts at the first line shown

### Changed
- Edit mode looks different from the view: the text column becomes a light gray sheet with faint ruled lines, while the side margins keep the page color (in both themes). The text column widens with the zoom, as in the view

---

**日本語**

幅の広いウィンドウでの目次、罫線入りの紙のような編集モード、表示と編集を切り替えても位置を保つ機能を追加しました。

**追加**
- ウィンドウの幅が広いとき（1280px 以上）、文書の右に目次を表示する。先頭は文書のタイトル（クリックで先頭へ戻る）、続けて見出し（2・3 段目）を並べ、読んでいる節を強調し、クリックで移動する。最初から表示し、「表示 → 目次を表示」で消せる（選択は次回も維持）。本文の位置と幅は変わらない
- 編集中は、ステータスバーにカーソルの行・列を表示する
- 表示と編集を切り替えても、文書のほぼ同じ位置を表示する（見出しを目印に合わせる）。編集に切り替えたときは、見えている先頭の行にカーソルを置く

**変更**
- 編集モードを表示モードと見分けやすくした。本文の幅の部分を薄いグレーの罫線入りの紙のようにし、左右の余白は表示モードと同じ色のままにする（ライト・ダークとも）。拡大・縮小すると、表示モードと同じく本文の幅も変わる

## [0.2.2] - 2026-09-29

The installer is now also available as a zip, the installer names its publisher, and the README states the code signing policy and privacy.

### Added
- Releases also include the installer as a zip (`mdviewer_x.y.z_x64-setup.zip`), for browsers and networks that warn about or block downloading an `.exe`

### Changed
- The installer registers "Kenichiro Murata" as the publisher (shown in Apps & features)
- The README describes the code signing policy (applying to SignPath Foundation) and privacy (no telemetry; network access only for `https://` images in the document). Release notes end with a note on code signing

---

**日本語**

インストーラを zip でも配布し、インストーラが発行元を登録するようにしました。README にコード署名の方針とプライバシーを記載しました。

**追加**
- インストーラを zip にしたもの（`mdviewer_x.y.z_x64-setup.zip`）もリリースに含める（ブラウザやネットワークで `.exe` のダウンロードが警告・禁止される場合のため）

**変更**
- インストーラが発行元として「Kenichiro Murata」を登録する（「アプリと機能」に表示される）
- README にコード署名の方針（SignPath Foundation に申請中）とプライバシー（利用状況の送信なし。ネットワークを使うのは文書中の `https://` の画像だけ）を記載。リリースノートの末尾にコード署名についての一文を入れる

## [0.2.1] - 2026-09-27

The View / Edit switch and the zoom level move to a status bar at the bottom, out of the way of the document. The README now opens with an animated demo.

### Changed
- The View / Edit switch moved to a new status bar at the bottom right, so nothing sits over the document or follows the scroll. The zoom level is shown there all the time (click for 100%) instead of a badge over the document. Tabs in edit mode are marked with a pencil
- The README opens with an animated demo (GIF) of the main screens; the screenshots show the new status bar

---

**日本語**

表示／編集の切替スイッチと倍率を、本文の邪魔にならない下端のステータスバーに移しました。README の冒頭にデモ（アニメーション GIF）を載せました。

**変更**
- 表示／編集の切替スイッチを、下端に新設したステータスバーの右端に移した（本文に重ならず、スクロールにも追随しない）。倍率もステータスバーに常に表示し（クリックで 100%）、本文の上に出ていた倍率表示はなくした。編集中のタブには鉛筆の印を付ける
- README の冒頭に主な画面のデモ（アニメーション GIF）を載せた。スクリーンショットもステータスバー付きの画面に撮り直した

## [0.2.0] - 2026-09-27

Menus, tabs, back / forward, find, a Japanese / English UI, a light / dark theme and a clearer View / Edit switch. The README and a new user guide (which doubles as a rendering sample) are now in English, with Japanese versions alongside.

### Added
- Menu bar (File, Edit, View, Go, Help). <kbd>Alt</kbd> / <kbd>F10</kbd> moves to the menu bar, <kbd>Alt</kbd>+<kbd>F</kbd> etc. opens a menu directly
- Tabs: other files open in new tabs. Double-clicking another `.md` while mdviewer is running opens it as a tab in the same window
- Back / forward: links in a document open in the same tab; go back and forward with <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd>, the tab bar buttons, the mouse back / forward buttons or the Go menu (the scroll position comes back too)
- Find (<kbd>Ctrl</kbd>+<kbd>F</kbd>): highlights matches and shows the count
- Help: keyboard shortcuts (<kbd>F1</kbd>) and About mdviewer (version, author, license)
- Menus in Japanese and English, chosen from the system language and switchable in the View menu
- Theme (View menu: Light / Dark). The first launch picks the one matching the system setting; after that your choice is kept. Diagram (Mermaid) colors and the window frame follow the theme
- User guide (English `docs/manual/`, Japanese `docs/manual/ja/`), which doubles as a sample of tables, diagrams, math, Mermaid and emoji. Screenshots in the README
- The README is split into English (`README.md`, shown first on GitHub) and Japanese (`README.ja.md`). It now states up front that heavy editing (tables, diagrams, translation and so on) is left to your LLM, so mdviewer adds no such features
- Layout that works when the window is small or maximized (spacing, a scrolling tab bar, a minimum size)

### Changed
- Rust issues an ID for each open document, and the UI reads and writes by ID only (to handle documents in tabs safely)
- IPC errors are returned as codes (such as `not-allowed`) and translated in the UI
- The window is created hidden and shown once the UI is ready, so starting in the dark theme no longer flashes white
- Edit mode uses the same text size as the body text in view mode (16px)
- The View / Edit button is now a "View | Edit" switch: larger, with icons, the current mode shaded gray, and easy to see in the dark theme. Documents have more space at the top so the switch does not cover the first line

---

**日本語**

メニュー、タブ、戻る／進む、検索、日本語／英語の UI、ライト／ダークのテーマ、分かりやすくした表示／編集の切替を追加しました。README と操作マニュアル（表示見本を兼ねる）は英語を標準にし、日本語版を併設しています。

**追加**
- メニューバー（ファイル・編集・表示・移動・ヘルプ）。Alt / F10 でメニューへ移動、Alt+F などで直接開く
- タブ：別のファイルは新しいタブで開く。起動中に別の `.md` をダブルクリックしても同じウィンドウのタブで開く
- 戻る・進む：文書内のリンクは同じタブで開き、Alt+← / Alt+→、タブバーのボタン、マウスの戻る／進むボタン、メニューで行き来できる（スクロール位置も戻る）
- 検索（Ctrl+F）：一致箇所のハイライトと件数表示
- ヘルプ（F1：ショートカット一覧）と「mdviewer について」（バージョン・作者・ライセンス）
- メニューの日本語・英語対応。OS の言語設定に合わせて自動で選び、表示メニューで切り替え可能
- テーマの切り替え（表示メニュー：ライト／ダーク）。初回起動時は OS の設定から自動で選び、以降は選択を維持する。図（Mermaid）の色とウィンドウの枠もテーマに合わせる
- 操作マニュアル（英語版 `docs/manual/`、日本語版 `docs/manual/ja/`）。表・図・数式・Mermaid・絵文字の表示見本を兼ねる。README にスクリーンショットを追加
- README を英語（`README.md`）と日本語（`README.ja.md`）に分け、GitHub で最初に表示される README を英語にした。冒頭で「大がかりな編集（表・図の編集、翻訳など）は LLM に任せ、mdviewer はそうした機能を追加しない」方針を示した
- ウィンドウを小さくしたとき・最大化したときのレイアウト調整（余白、タブバーの横スクロール、最小サイズ）

**変更**
- Rust 側は開いた文書ごとに ID を発行し、画面側は ID で読み書きする（タブごとの文書を安全に扱うため）
- IPC のエラーはコード（`not-allowed` など）で返し、画面側で翻訳して表示する
- ウィンドウは非表示で作成し、画面の準備ができてから表示する（ダークテーマで起動したときに白く表示されないように）
- 編集モードの文字サイズを、表示モードの本文と同じ大きさ（16px）にした
- 表示／編集の切替ボタンを「表示 | 編集」の切替スイッチにした。今のモードをグレーで示し、アイコン付きで大きく、ダークテーマでも見やすくした。本文の上に余白を取り、スイッチが1行目に重ならないようにした

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

[Unreleased]: https://github.com/muraken720/mdviewer/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/muraken720/mdviewer/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/muraken720/mdviewer/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/muraken720/mdviewer/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/muraken720/mdviewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/muraken720/mdviewer/releases/tag/v0.1.0
