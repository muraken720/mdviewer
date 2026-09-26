//! IPC commands called from the UI (`invoke(...)`). Keep these thin: logic lives in `mdcore`.
//! The UI-side counterpart is `ui/src/backend/tauri.ts`.
//!
//! File access goes through [`Session`]: the UI can only open files the user chose or relative
//! links from the current document, and it can only save/poll the current document.

use std::path::{Path, PathBuf};

use mdcore::document::{self, Document};
use mdcore::{url, Renderer};
use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

use crate::session::Session;
use crate::settings::Settings;

/// Payload sent to the UI. Keep in sync with `Doc` in `ui/src/core/types.ts`.
#[derive(Serialize)]
pub struct Loaded {
    path: String,
    name: String,
    raw: String,
    html: String,
    mtime: u64,
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

/// Open a file the user chose (see [`Session::allow`]).
#[tauri::command]
pub fn open(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    path: String,
) -> Result<Loaded, String> {
    let path = PathBuf::from(path);
    session.check_allowed(&path)?;
    load(&window, &session, &renderer, path)
}

/// Open a relative link found in the current document.
#[tauri::command]
pub fn open_link(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    href: String,
) -> Result<Loaded, String> {
    let path = session.resolve_link(&href)?;
    load(&window, &session, &renderer, path)
}

/// Re-read the current document.
#[tauri::command]
pub fn reload(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
) -> Result<Loaded, String> {
    let path = session.current()?;
    load(&window, &session, &renderer, path)
}

/// Render unsaved editor text as if it were the current document.
#[tauri::command]
pub fn render(
    window: WebviewWindow,
    session: State<'_, Session>,
    renderer: State<'_, Renderer>,
    text: String,
) -> Result<String, String> {
    let path = session.current()?;
    Ok(render_html(&window, &renderer, &text, parent(&path)))
}

/// Save editor text to the current document, keeping its BOM and line endings.
/// Returns the new modification time.
#[tauri::command]
pub fn save(session: State<'_, Session>, text: String) -> Result<u64, String> {
    let path = session.current()?;
    document::save(&path, &text).map_err(|e| format!("{}: {e}", path.display()))
}

/// Modification time of the current document in ms (0 if unavailable). Polled for auto-reload.
#[tauri::command]
pub fn mtime(session: State<'_, Session>) -> u64 {
    session.current().map_or(0, |p| document::mtime(&p))
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
pub fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    if !url::is_web_url(&url) {
        return Err(format!("このリンクは開けません: {url}"));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

fn load(
    window: &WebviewWindow,
    session: &Session,
    renderer: &Renderer,
    path: PathBuf,
) -> Result<Loaded, String> {
    let doc = Document::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let html = render_html(window, renderer, &doc.text, doc.dir());
    session.set_current(path);
    Ok(Loaded {
        path: doc.path.to_string_lossy().into_owned(),
        name: doc.name(),
        raw: doc.text,
        html,
        mtime: doc.mtime,
    })
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
