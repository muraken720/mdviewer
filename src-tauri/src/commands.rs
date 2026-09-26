//! IPC commands called from the UI (`invoke(...)`). Keep these thin: logic lives in `mdcore`.
//! The UI-side counterpart is `ui/src/backend/tauri.ts`.
//!
//! File access goes through [`Session`]: the UI can only open files the user chose or relative
//! links from an open document, and it reads/writes open documents by [`DocId`], never by path.

use std::path::{Path, PathBuf};

use mdcore::document::{self, Document};
use mdcore::{url, Renderer};
use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

use crate::error::{CommandError, CommandResult};
use crate::session::{DocId, Session};
use crate::settings::Settings;

/// Payload sent to the UI. Keep in sync with `Doc` in `ui/src/core/types.ts`.
#[derive(Serialize)]
pub struct Loaded {
    id: DocId,
    path: String,
    name: String,
    raw: String,
    html: String,
    mtime: u64,
}

/// Shown in the About dialog. Keep in sync with `AppInfo` in `ui/src/core/types.ts`.
#[derive(Serialize)]
pub struct AppInfo {
    name: &'static str,
    version: &'static str,
    authors: &'static str,
    license: &'static str,
    repository: &'static str,
}

/// Path the app was started with (double-click, "Open with", `mdviewer foo.md`), if any.
#[tauri::command]
pub fn initial_path(initial: State<'_, InitialPath>) -> Option<String> {
    initial.0.as_ref().map(|p| p.to_string_lossy().into_owned())
}

/// The command-line file, resolved and allowed at startup.
pub struct InitialPath(pub Option<PathBuf>);

#[tauri::command]
pub fn settings(settings: State<'_, Settings>) -> Settings {
    settings.inner().clone()
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "mdviewer",
        version: env!("CARGO_PKG_VERSION"),
        authors: env!("CARGO_PKG_AUTHORS"),
        license: env!("CARGO_PKG_LICENSE"),
        repository: env!("CARGO_PKG_REPOSITORY"),
    }
}

/// Open a file the user chose (see [`Session::allow`]) as a new document.
#[tauri::command]
pub fn open(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    path: String,
) -> CommandResult<Loaded> {
    let path = PathBuf::from(path);
    session.check_allowed(&path)?;
    let doc = read(&path)?;
    Ok(loaded(&window, &renderer, session.register(path), doc))
}

/// Open a relative link found in document `from` as a new document.
#[tauri::command]
pub fn open_link(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    from: DocId,
    href: String,
) -> CommandResult<Loaded> {
    let path = session.resolve_link(from, &href)?;
    let doc = read(&path)?;
    Ok(loaded(&window, &renderer, session.register(path), doc))
}

/// Re-read an open document.
#[tauri::command]
pub fn reload(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    doc: DocId,
) -> CommandResult<Loaded> {
    let path = session.path(doc)?;
    let read = read(&path)?;
    Ok(loaded(&window, &renderer, doc, read))
}

/// Render unsaved editor text as if it were document `doc`.
#[tauri::command]
pub fn render(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    doc: DocId,
    text: String,
) -> CommandResult<String> {
    let path = session.path(doc)?;
    Ok(render_html(&window, &renderer, &text, parent(&path)))
}

/// Save editor text to document `doc`, keeping its BOM and line endings.
/// Returns the new modification time.
#[tauri::command]
pub fn save(session: State<'_, Session>, doc: DocId, text: String) -> CommandResult<u64> {
    let path = session.path(doc)?;
    document::save(&path, &text).map_err(|e| CommandError::Io(format!("{}: {e}", path.display())))
}

/// Modification time of document `doc` in ms (0 if unavailable). Polled for auto-reload.
#[tauri::command]
pub fn mtime(session: State<'_, Session>, doc: DocId) -> u64 {
    session.path(doc).map_or(0, |p| document::mtime(&p))
}

/// Forget a document the UI no longer shows.
#[tauri::command]
pub fn close_doc(session: State<'_, Session>, doc: DocId) {
    session.close(doc);
}

/// File dialog. The chosen file is allowed to be opened.
#[tauri::command]
pub async fn pick_file(app: AppHandle) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .add_filter("Markdown", mdcore::paths::DOCUMENT_EXTENSIONS)
        .blocking_pick_file()?
        .into_path()
        .ok()?;
    app.state::<Session>().allow(path.clone());
    Some(path.to_string_lossy().into_owned())
}

/// OK/Cancel confirmation dialog. Returns true for OK.
#[tauri::command]
pub async fn ask(app: AppHandle, message: String) -> bool {
    app.dialog()
        .message(message)
        .title("mdviewer")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show()
}

/// Open a web link in the default browser. Only well-formed `http(s):` and `mailto:` URLs.
#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> CommandResult<()> {
    if !url::is_web_url(&url) {
        return Err(CommandError::InvalidUrl(url));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| CommandError::Io(e.to_string()))
}

fn read(path: &Path) -> CommandResult<Document> {
    Document::read(path).map_err(|e| CommandError::Io(format!("{}: {e}", path.display())))
}

fn loaded(window: &WebviewWindow, renderer: &Renderer, id: DocId, doc: Document) -> Loaded {
    let html = render_html(window, renderer, &doc.text, doc.dir());
    Loaded {
        id,
        path: doc.path.to_string_lossy().into_owned(),
        name: doc.name(),
        raw: doc.text,
        html,
        mtime: doc.mtime,
    }
}

/// Render and grant the webview access to the local images the document refers to
/// (only relative image files; see `mdcore::plugins::LocalImages`).
fn render_html(window: &WebviewWindow, renderer: &Renderer, text: &str, dir: &Path) -> String {
    let out = renderer.render(text, dir);
    let scope = window.asset_protocol_scope();
    for asset in &out.assets {
        let _ = scope.allow_file(asset);
    }
    out.html
}

fn parent(path: &Path) -> &Path {
    path.parent().unwrap_or(Path::new(""))
}
