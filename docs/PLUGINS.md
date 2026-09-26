# プラグインの作り方

mdviewer の機能は、Rust 側の **Markdown プラグイン** と TypeScript 側の **UI プラグイン** の組み合わせでできています。
どちらもビルド時に組み込む方式です。登録箇所に 1 行足せば追加でき、利用者は `settings.json` でプラグインごとに有効／無効を切り替えられます（[README](../README.md#設定)）。

> 新しい機能を足す前に、[スコープ方針](../CONTRIBUTING.md#スコープ方針) を満たすか確認してください。

## Markdown プラグイン（Rust）

`crates/mdcore/src/pipeline.rs` の `Plugin` trait を実装します。

```rust
pub trait Plugin: Send + Sync {
    fn name(&self) -> &'static str;
    /// 構文解析の前にソースを書き換える（パーサが知らない記法を揃えるなど）
    fn preprocess<'a>(&self, markdown: Cow<'a, str>) -> Cow<'a, str> { markdown }
    /// 必要なパーサ機能（表など）。全プラグインの OR が使われる
    fn parser_options(&self) -> Options { Options::empty() }
    /// pulldown-cmark のイベント列を書き換える。登録順に実行される
    fn transform<'a>(&self, events: Vec<Event<'a>>, ctx: &mut Context) -> Vec<Event<'a>> { events }
}
```

処理は次の順に進みます：`preprocess` → 構文解析 → `transform` → HTML の生成。
`Context` には、文書のあるディレクトリ（`base_dir`）と、WebView に読み込みを許可するローカルファイルの一覧（`assets`）が入っています。

実例は `plugins/math.rs`（`preprocess` と `parser_options`）、`plugins/heading_anchors.rs`（`transform`）を参照してください。

### 例: 外部リンクに `↗` を付ける

`crates/mdcore/src/plugins/external_mark.rs`

```rust
use pulldown_cmark::{Event, Tag, TagEnd};
use crate::{url, Context, Plugin};

pub struct ExternalMark;

impl Plugin for ExternalMark {
    fn name(&self) -> &'static str { "external-mark" }

    fn transform<'a>(&self, events: Vec<Event<'a>>, _: &mut Context) -> Vec<Event<'a>> {
        let mut out = Vec::with_capacity(events.len());
        let mut external = Vec::new(); // リンクの入れ子に対応するためスタックで持つ
        for ev in events {
            match &ev {
                Event::Start(Tag::Link { dest_url, .. }) => external.push(url::is_web_url(dest_url)),
                Event::End(TagEnd::Link) => {
                    if external.pop() == Some(true) {
                        out.push(Event::Text(" ↗".into()));
                    }
                }
                _ => {}
            }
            out.push(ev);
        }
        out
    }
}
```

1. `plugins/mod.rs` に `mod external_mark; pub use external_mark::ExternalMark;` を追加する
2. 同じファイルに `#[cfg(test)]` のテストを書く（`Renderer::new().with(ExternalMark).render(..)` の結果を確かめる）
3. `src-tauri/src/main.rs` の `renderer()` に `.with(ExternalMark)` を追加する

Markdown プラグインは既定で有効です。`settings.json` に `"plugins": { "external-mark": false }` と書けば無効にできます（`Renderer::retain` を使用）。

### 指針

- 入出力はイベント列（またはソース文字列）だけにし、ファイルシステムや OS に触れない。必要なら `LocalImages` のように関数を外から渡してもらう
- ローカルファイルを参照させるときは `ctx.assets` に追加する（追加しないと WebView から読めない）
- 生成する HTML に `<script>` を含めない（CSP によって実行されない）

## UI プラグイン（TypeScript）

`ui/src/plugins/` にモジュールを置き、`ui/src/plugins/index.ts` の配列に追加します。

```ts
import type { Plugin } from '../core/types';

const myPlugin: Plugin = {
  name: 'my-plugin',
  // enabledByDefault: false,  // 既定で無効にする場合
  setup(app) {
    // コマンド、イベント、画面部品を登録する
  },
};
export default myPlugin;
```

### App API（`ui/src/core/app.ts`）

| API | 説明 |
|---|---|
| `app.doc` | 表示中の文書 `{ path, name, raw, html, mtime }` または `null`。`raw` は編集中のテキスト、`html` は最後に描画した結果 |
| `app.mode` | `'view'` か `'edit'` |
| `app.dirty` | 未保存の変更があるか |
| `app.error` | 文書の代わりに表示するエラー（開けなかったときなど） |
| `app.settings` / `app.storage` | `settings.json` の内容 / 値を保存する `get` / `set` |
| `app.on(event, fn)` / `app.emit(event, ...args)` | イベントの購読（戻り値は購読解除の関数）/ 発行。型は `AppEvents` |
| `app.command({ id, title?, keys?, run })` | コマンドを登録する。`title` と `keys` があれば起動画面のショートカット一覧に載る。ID の重複はエラー |
| `app.run(id)` / `app.commands()` | コマンドの実行 / 一覧 |
| `app.addPane(mode, Component)` | そのモードで表示する画面を登録する。画面はモードが変わってもマウントされたままで、`active` プロパティで表示・非表示を切り替える |
| `app.addOverlay(Component)` | 画面の上に重ねる部品を登録する（ボタン、バッジ、通知など） |
| `app.open(path, base?)` | 文書を開く（`base` を渡すと、その文書からの相対パスとして解決する） |
| `app.reload({ force? })` | 再読み込みする。未保存の変更があるときは、`force` を付けない限り何もしない |
| `app.update(text)` / `app.refresh()` / `app.save()` | テキストの更新 / 変更があれば再描画 / 保存（外部で変更されていれば確認する） |
| `app.confirmDiscard()` | 未保存の変更を破棄してよいか確認する（変更がなければすぐに true を返す） |
| `app.setMode(mode)` | 表示と編集を切り替える。`'view'` に切り替えるときは `refresh()` も行う |
| `app.backend` | ホスト機能（`Backend` 型：`load`, `render`, `save`, `mtime`, `pickFile`, `ask`, `openUrl`, `initialPath`, `setTitle`, `onDrop`, `onCloseRequested`） |

画面部品の中で `app` の変化に追随して再描画したいときは、`useAppVersion(app)`（`core/useApp.ts`）を呼びます。

### イベント

| イベント | 引数 | タイミング |
|---|---|---|
| `app:start` | — | すべてのプラグインを登録し、画面を描画した後 |
| `doc:loaded` | `doc, { reset }` | 文書を開いた（`reset: true`）／再読み込みした（`reset: false`） |
| `doc:rendered` | `doc` | 編集中のテキストを再描画した（`doc.html` が更新された） |
| `doc:dirty` | `dirty` | 未保存状態が変わった |
| `doc:saved` | `doc` | 保存した |
| `doc:error` | `error` | 読み込みに失敗した |
| `mode:changed` | `mode` | 表示と編集を切り替えた |
| `toast` | `message` | 通知を表示する（例: 保存の失敗） |
| `view:updated` | `root: HTMLElement` | 本文の HTML を差し替えた。本文を加工するプラグインはこれを購読する |
| `plugin:<名前>` | 任意 | プラグイン独自のイベント（例: `plugin:zoom`） |

### 例: 本文を加工する（`view:updated`）

```ts
// ui/src/plugins/external-links.ts
import type { Plugin } from '../core/types';

export function markExternal(root: HTMLElement): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) a.title = a.href;
}

const externalLinks: Plugin = {
  name: 'external-links',
  setup(app) {
    app.on('view:updated', markExternal);
  },
};
export default externalLinks;
```

重いライブラリは `setup` の中で読み込まず、必要になった時点で `import()` します。Vite が別チャンクに分けるので、起動時間に影響しません（`math.ts` と `mermaid.ts` を参照）。

### 例: 画面部品を追加する

```tsx
import type { App } from '../core/app';
import type { Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';

function WordCount({ app }: { app: App }) {
  useAppVersion(app);
  if (!app.doc) return null;
  return <div className="fixed bottom-4 left-4 text-xs text-muted">{app.doc.raw.length} 文字</div>;
}

const wordCount: Plugin = { name: 'word-count', setup: (app) => app.addOverlay(WordCount) };
export default wordCount;
```

スタイルは Tailwind のユーティリティで書きます。テーマ色（`text-fg`, `bg-bg`, `border-line`, `text-muted`, `text-link`, `bg-caution`）を使えば、ダークモードにも自動で対応します。

### 指針

- **純粋なロジックは名前付きで export し、同じ場所の `*.test.ts` でテストする**（例：`classifyLink`, `clampZoom`, `checkForChange`, `windowTitle`, `typeset`, `lib/markdown-edit.ts`）。`setup` や画面部品には、つなぎ込みだけを書く
- Tauri を直接呼ばず、`app.backend` を使う。新しい IPC が必要になったら、次の 4 か所をすべて更新する
  - `Backend` 型（`core/types.ts`）
  - Tauri 実装（`backend/tauri.ts`）
  - テスト用の偽実装（`test/fake-backend.ts`）
  - Rust のコマンド（`src-tauri/src/commands.rs`）
- キー操作は `keydown` を自分で監視せず、`app.command()` で登録する（キーの衝突を見つけやすくするため）。例外はエディタの中だけで効くキー（Enter, Tab など）で、`editor.tsx` が textarea で処理する
- 新しいエディタ操作は、`lib/markdown-edit.ts` に `EditOperation`（`(state) => Edit | null`）の純粋関数として追加し、`editor.tsx` の `KEYS` に割り当てる
