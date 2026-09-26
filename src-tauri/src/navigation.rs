//! Keeps the window on the app's own pages.
//!
//! Documents may contain raw HTML. Even without script, `<meta http-equiv="refresh">`, forms or
//! `<area>`/SVG links could navigate the window to a remote page that impersonates the app.
//! Links are handled by the UI (`ui/src/plugins/links.ts`); every other navigation is refused.

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navigation-guard")
        .on_navigation(|_webview, url| is_app_url(url, cfg!(dev)))
        .build()
}

/// The app's own origin: `tauri://localhost` (Linux/macOS), `http://tauri.localhost` (Windows),
/// or the Vite dev server during `tauri dev`.
pub fn is_app_url(url: &Url, dev: bool) -> bool {
    match (url.scheme(), url.host_str()) {
        ("tauri", Some("localhost")) => true,
        ("http" | "https", Some("tauri.localhost")) => true,
        ("http", Some("localhost")) => dev,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allowed(url: &str, dev: bool) -> bool {
        is_app_url(&Url::parse(url).unwrap(), dev)
    }

    #[test]
    fn only_the_app_origin_is_allowed() {
        assert!(allowed("tauri://localhost/index.html", false));
        assert!(allowed("http://tauri.localhost/", false));
        assert!(allowed("http://localhost:5173/", true));
        assert!(!allowed("http://localhost:5173/", false));
        assert!(!allowed("https://evil.example/login", false));
        assert!(!allowed("http://asset.localhost/C%3A%5Ca.png", false));
        assert!(!allowed("file:///C:/a.html", false));
    }
}
