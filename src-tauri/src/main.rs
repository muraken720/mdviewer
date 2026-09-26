#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod platform;
mod settings;

use mdcore::plugins::{Gfm, HeadingAnchors, LocalImages, Math};
use mdcore::Renderer;
use settings::Settings;
use tauri::Manager;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let settings = Settings::load(&path);
            app.manage(renderer(&settings));
            app.manage(settings);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::initial_path,
            commands::settings,
            commands::load,
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
