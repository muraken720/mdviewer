//! IPC commands called from the UI (`invoke(...)`). Keep these thin: logic lives in `mdcore`.
//! The UI-side counterpart is `ui/backend.js`.

use std::path::{Path, PathBuf};

use mdcore::document::{self, Document};
use mdcore::{paths, url, Renderer};
use serde::Serialize;
use tauri::{Manager, State, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::settings::Settings;

/// Payload sent to the UI. Keep in sync with the `Doc` typedef in `ui/core.js`.
#[derive(Serialize)]
pub struct Loaded {
    path: String,
    name: String,
    raw: String,
    html: String,
    mtime: u64,
}

/// File passed on the command line (double-click, "Open with", `mdviewer foo.md`).
#[tauri::command]
pub fn initial_path() -> Option<String> {
    std::env::args().skip(1).find(|a| !a.starts_with('-'))
}

#[tauri::command]
pub fn settings(settings: State<'_, Settings>) -> Settings {
    settings.inner().clone()
}

/// Read and render `path`. If `base` (the current document) is given, `path` is resolved
/// relative to it, so links between Markdown files work.
#[tauri::command]
pub fn load(
    window: WebviewWindow,
    renderer: State<'_, Renderer>,
    path: String,
    base: Option<String>,
) -> Result<Loaded, String> {
    let path = match base.as_deref().map(Path::new).and_then(Path::parent) {
        Some(dir) => paths::resolve(dir, &path),
        None => PathBuf::from(&path),
    };
    let doc = Document::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let html = render_html(&window, &renderer, &doc.text, doc.dir());
    Ok(Loaded {
        path: doc.path.to_string_lossy().into_owned(),
        name: doc.name(),
        raw: doc.text,
        html,
        mtime: doc.mtime,
    })
}

/// Render unsaved editor text as if it were the file at `path`.
#[tauri::command]
pub fn render(window: WebviewWindow, renderer: State<'_, Renderer>, text: String, path: String) -> String {
    let dir = Path::new(&path).parent().unwrap_or(Path::new(""));
    render_html(&window, &renderer, &text, dir)
}

/// Save editor text, keeping the file's BOM and line endings. Returns the new mtime.
#[tauri::command]
pub fn save(path: String, text: String) -> Result<u64, String> {
    document::save(Path::new(&path), &text).map_err(|e| format!("{path}: {e}"))
}

/// Modification time in ms (0 if unavailable). Polled by the auto-reload UI plugin.
#[tauri::command]
pub fn mtime(path: String) -> u64 {
    document::mtime(Path::new(&path))
}

#[tauri::command]
pub async fn pick_file(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

/// OK/Cancel confirmation dialog. Returns true for OK.
#[tauri::command]
pub async fn ask(app: tauri::AppHandle, message: String) -> bool {
    app.dialog()
        .message(message)
        .title("mdviewer")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show()
}

/// Open a web link in the default browser. Only `http(s):` and `mailto:` are accepted.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url::is_web_url(&url) {
        return Err(format!("refused to open: {url}"));
    }
    crate::platform::open_in_browser(&url).map_err(|e| e.to_string())
}

/// Render and grant the webview access to the local images the document refers to.
fn render_html(window: &WebviewWindow, renderer: &Renderer, text: &str, dir: &Path) -> String {
    let out = renderer.render(text, dir);
    let scope = window.asset_protocol_scope();
    for asset in &out.assets {
        let _ = scope.allow_file(asset);
    }
    out.html
}
