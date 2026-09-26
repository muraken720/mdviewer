#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![forbid(unsafe_code)]

mod commands;
mod navigation;
mod platform;
mod session;
mod settings;

use std::path::PathBuf;

use commands::InitialPath;
use mdcore::plugins::{Gfm, HeadingAnchors, LocalImages, Math};
use mdcore::Renderer;
use session::Session;
use settings::Settings;
use tauri::{DragDropEvent, Emitter, Manager, WindowEvent};

/// Event sent to the UI when the user drops a file on the window (payload: the path).
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

/// The first non-flag command-line argument, as an absolute path.
fn command_line_path() -> Option<PathBuf> {
    let arg = std::env::args_os()
        .skip(1)
        .find(|a| !a.to_string_lossy().starts_with('-'))?;
    std::path::absolute(arg)
        .ok()
        .map(|p| mdcore::paths::normalize(&p))
}

fn main() {
    tauri::Builder::default()
        .plugin(navigation::guard())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let settings = Settings::load(&app.path().app_config_dir()?.join("settings.json"));
            let session = Session::default();
            let initial = command_line_path();
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
                if let Some(path) = paths.first() {
                    window.state::<Session>().allow(path.clone());
                    let _ = window.emit(OPEN_REQUEST_EVENT, path.to_string_lossy());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::initial_path,
            commands::settings,
            commands::open,
            commands::open_link,
            commands::reload,
            commands::render,
            commands::save,
            commands::mtime,
            commands::pick_file,
            commands::ask,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mdviewer");
}
