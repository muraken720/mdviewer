//! IPC commands called from the UI (`invoke(...)`). Keep these thin: logic lives in `mdcore`.

use std::path::{Path, PathBuf};

use mdcore::document::{self, Document};
use mdcore::{paths, url, Renderer};
use serde::Serialize;
use tauri::{Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// Payload sent to the UI. Keep in sync with `ui/core.js`.
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
    let out = renderer.render(&doc.text, doc.dir());

    let scope = window.asset_protocol_scope();
    for asset in &out.assets {
        let _ = scope.allow_file(asset);
    }
    let _ = window.set_title(&format!("{} - mdviewer", doc.name()));

    Ok(Loaded {
        path: doc.path.to_string_lossy().into_owned(),
        name: doc.name(),
        raw: doc.text,
        html: out.html,
        mtime: doc.mtime,
    })
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

/// Open a web link in the default browser. Only `http(s):` and `mailto:` are accepted.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url::is_web_url(&url) {
        return Err(format!("refused to open: {url}"));
    }
    crate::platform::open_in_browser(&url).map_err(|e| e.to_string())
}
