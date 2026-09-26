#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![forbid(unsafe_code)]

mod commands;
mod error;
mod navigation;
mod platform;
mod session;
mod settings;

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use commands::InitialPath;
use mdcore::plugins::{Gfm, HeadingAnchors, LocalImages, Math};
use mdcore::Renderer;
use session::Session;
use settings::Settings;
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, WindowEvent};

/// Event sent to the UI when the user asks to open a file (drop, second launch).
/// Payload: the path, already allowed in the [`Session`].
const OPEN_REQUEST_EVENT: &str = "open-request";

/// The Markdown rendering pipeline. Add or remove Markdown plugins here.
/// All of them are on by default; `settings.json` can turn any of them off.
fn renderer(settings: &Settings) -> Renderer {
    Renderer::new()
        .with(Gfm)
        .with(HeadingAnchors)
        .with(Math)
        .with(LocalImages::new(platform::asset_url))
        .retain(|name| settings.plugin_enabled(name, true))
}

/// The first non-flag argument after the executable, as an absolute path.
fn path_argument(args: impl IntoIterator<Item = OsString>, cwd: &Path) -> Option<PathBuf> {
    let arg = args
        .into_iter()
        .skip(1)
        .find(|a| !a.to_string_lossy().starts_with('-'))?;
    Some(mdcore::paths::normalize(&cwd.join(arg)))
}

/// Allow `path` and ask the UI to open it in a new tab.
fn request_open(app: &AppHandle, path: PathBuf) {
    app.state::<Session>().allow(path.clone());
    let _ = app.emit(OPEN_REQUEST_EVENT, path.to_string_lossy());
}

fn main() {
    tauri::Builder::default()
        // Must be first: a second launch (e.g. double-clicking another .md) hands its file to the
        // running window, which opens it in a new tab.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(path) = path_argument(args.into_iter().map(OsString::from), Path::new(&cwd)) {
                request_open(app, path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(navigation::guard())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let settings = Settings::load(&app.path().app_config_dir()?.join("settings.json"));
            let session = Session::default();
            let cwd = std::env::current_dir().unwrap_or_default();
            let initial = path_argument(std::env::args_os(), &cwd);
            if let Some(path) = &initial {
                session.allow(path.clone());
            }
            app.manage(renderer(&settings));
            app.manage(settings);
            app.manage(session);
            app.manage(InitialPath(initial));
            Ok(())
        })
        .on_window_event(|window, event| {
            // Dropped files are allowed here, in Rust, before the UI is asked to open them.
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                for path in paths {
                    request_open(window.app_handle(), path.clone());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::initial_path,
            commands::settings,
            commands::app_info,
            commands::open,
            commands::open_link,
            commands::reload,
            commands::render,
            commands::save,
            commands::mtime,
            commands::close_doc,
            commands::pick_file,
            commands::ask,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mdviewer");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<OsString> {
        list.iter().map(OsString::from).collect()
    }

    #[test]
    fn path_argument_is_absolute_and_skips_flags() {
        let cwd = Path::new("/home/u");
        assert_eq!(
            path_argument(args(&["mdviewer", "--flag", "docs/../a.md"]), cwd),
            Some(PathBuf::from("/home/u/a.md"))
        );
        assert_eq!(
            path_argument(args(&["mdviewer", "/tmp/b.md"]), cwd),
            Some(PathBuf::from("/tmp/b.md"))
        );
        assert_eq!(path_argument(args(&["mdviewer"]), cwd), None);
    }
}
