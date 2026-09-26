#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod platform;

use mdcore::plugins::{Gfm, HeadingAnchors, LocalImages};
use mdcore::Renderer;

/// The rendering pipeline. Add or remove Markdown plugins here.
fn renderer() -> Renderer {
    Renderer::new()
        .with(Gfm)
        .with(HeadingAnchors)
        .with(LocalImages::new(platform::asset_url))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(renderer())
        .invoke_handler(tauri::generate_handler![
            commands::initial_path,
            commands::load,
            commands::mtime,
            commands::pick_file,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mdviewer");
}
