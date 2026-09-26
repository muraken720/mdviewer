# プラグインの作り方

mdviewer の機能は、Rust 側の **Markdown プラグイン** と JS 側の **UI プラグイン** の組み合わせでできています。
どちらもコンパイル時に組み込む方式です。登録箇所に 1 行足せば追加でき、利用者は `settings.json` でプラグインごとに有効／無効を切り替えられます（[README](../README.md#設定)）。

> 新しい機能を足す前に、[スコープ方針](../CONTRIBUTING.md#スコープ方針) を満たすか確認してください。

## Markdown プラグイン（Rust）

`crates/mdcore/src/pipeline.rs` の `Plugin` trait を実装します。

```rust
pub trait Plugin: Send + Sync {
    fn name(&self) -> &'static str;
    /// 必要なパーサ機能（表など）。全プラグインの OR が使われる
    fn parser_options(&self) -> Options { Options::empty() }
    /// pulldown-cmark のイベント列を書き換える。登録順に実行される
    fn transform<'a>(&self, events: Vec<Event<'a>>, ctx: &mut Context) -> Vec<Event<'a>> { events }
}
```

`Context` には、文書のあるディレクトリ（`base_dir`）と、WebView に読み込みを許可するローカルファイルの一覧（`assets`）が入っています。

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

1. `plugins/mod.rs` に `mod external_mark; pub use external_mark::ExternalMark;` を追加
2. 同じファイルに `#[cfg(test)]` のテストを書く（`Renderer::new().with(ExternalMark).render(..)` の結果を確かめる）
3. `src-tauri/src/main.rs` の `renderer()` に `.with(ExternalMark)` を追加

Markdown プラグインは既定で有効です。`settings.json` の `"plugins": { "external-mark": false }` で無効にできます（`Renderer::retain`）。

### 指針

- 入出力は `Vec<Event>` だけにし、ファイルシステムや OS に触れない（必要なら `LocalImages` のように関数を注入してもらう）
- ローカルファイルを参照させるときは `ctx.assets` に追加する（追加しないと WebView から読めない）
- 生成する HTML に `<script>` を含めない（CSP で実行されない）

## UI プラグイン（JavaScript）

`{ name, setup(app) }` を default export する ES Module を `ui/plugins/` に置き、`ui/plugins/index.js` の配列に加えます。
`enabledByDefault: false` を付けると既定で無効になり、`settings.json` で `true` にしたときだけ読み込まれます。
既定で無効にするのは、利用者によっては邪魔になる振る舞いを持つ場合に限ります。**同梱ファイルは無効でも exe に含まれるので、サイズ対策にはなりません**（サイズ・速度は遅延読み込みで対処します）。

重いライブラリが必要なときは `ui/vendor/<name>/` に置き、`setup` では読み込まず、実際に必要になった時点で `<script>` を追加して読み込みます（`mermaid.js` の `loadMermaid()` を参照）。

### App API（`ui/core.js`）

| API | 説明 |
|---|---|
| `app.doc` | 表示中の文書 `{ path, name, raw, html, mtime }` または `null`。`raw` は編集中のテキスト、`html` は最後に描画した結果 |
| `app.mode` | `'view'` か `'edit'` |
| `app.dirty` | 未保存の変更があるか |
| `app.settings` | `settings.json` の内容 |
| `app.on(event, fn)` | イベントを購読する。戻り値は購読解除関数 |
| `app.emit(event, ...args)` | イベントを発行する |
| `app.command(id, fn, keys?)` | コマンドを登録する。`keys` はキー割り当て（例 `['Ctrl+E']`）。ID の重複はエラー |
| `app.run(id)` | コマンドを実行する |
| `app.keys()` | 登録済みのキー割り当て一覧 |
| `app.open(path, base?)` | 文書を開く（`base` を渡すとその文書からの相対パスとして解決） |
| `app.reload({ force? })` | 表示中の文書を再読み込みする（スクロール位置は維持）。未保存の変更があるときは `force` がない限り何もしない |
| `app.update(text)` | 編集中のテキストを置き換える |
| `app.refresh()` | 編集中のテキストが前回の描画から変わっていれば再描画する |
| `app.save()` | 保存する。外部で変更されていれば確認する |
| `app.confirmDiscard()` | 未保存の変更を破棄してよいか確認する（変更がなければ即 true） |
| `app.setMode(mode)` | 表示と編集を切り替える。`'view'` に切り替えるときは `refresh()` する |
| `app.backend` | ホスト機能（`load`, `render`, `save`, `mtime`, `pickFile`, `ask`, `openUrl`, `initialPath`, `setTitle`, `onDrop`, `onCloseRequested`） |
| `app.storage` | 永続化用の `get(key)` / `set(key, value)` |

### イベント

| イベント | 引数 | タイミング |
|---|---|---|
| `app:start` | — | すべてのプラグインを登録した後 |
| `doc:loaded` | `doc, { reset }` | 文書を開いた（`reset: true`）／再読み込みした（`reset: false`） |
| `doc:rendered` | `doc` | 編集中のテキストを再描画した（`doc.html` が更新された） |
| `doc:dirty` | `dirty` | 未保存状態が変わった |
| `doc:saved` | `doc` | 保存した |
| `doc:error` | `error, { keepView? }` | 読み込み・保存に失敗した |
| `mode:changed` | `mode` | 表示と編集を切り替えた |

`doc.html` を加工するプラグイン（例: `mermaid`）は `doc:loaded` と `doc:rendered` の両方を購読してください。

### 例: 見出し数をステータス表示する

```js
// ui/plugins/heading-count.js
export function countHeadings(raw) {
  return raw.split('\n').filter((l) => /^#{1,6}\s/.test(l)).length;
}

export default {
  name: 'heading-count',
  setup(app) {
    app.on('doc:loaded', (doc) => {
      document.title = `${doc.name} (${countHeadings(doc.raw)} headings)`;
    });
  },
};
```

### 指針

- **純粋なロジックは名前付きで export し、`tests/ui/` でテストする**（例: `classifyLink`, `clampZoom`, `checkForChange`, `windowTitle`, `lib/markdown-edit.js`）。`setup` の中には DOM とのつなぎ込みだけを書く
- Tauri を直接呼ばず `app.backend` を使う。Tauri の新しいコマンドが必要なら、`Backend` に関数を足し、`backend.js` とテスト用の `tests/ui/fake-backend.js` の両方に実装する
- キー操作は `keydown` を自分で監視せず、`app.command(id, fn, keys)` で登録する（キーの衝突を見つけやすくするため）。例外はエディタ内だけで効くキー（Enter, Tab など）で、`editor.js` が textarea 上で処理する
- 新しいエディタ操作は `ui/lib/markdown-edit.js` に `(state) => Edit | null` の純粋関数として追加し、`editor.js` の `KEYS` に割り当てる
