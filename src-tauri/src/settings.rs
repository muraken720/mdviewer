//! User settings: `<config dir>/settings.json`
//! (Windows: `%APPDATA%\io.github.muraken720.mdviewer\settings.json`).
//!
//! ```json
//! { "plugins": { "mermaid": true, "auto-reload": false } }
//! ```
//!
//! `plugins` turns Markdown (Rust) and UI (JS) plugins on or off by name.
//! Plugins not listed keep their default.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub plugins: HashMap<String, bool>,
}

impl Settings {
    /// Load from `path`. A missing file gives defaults; an invalid one is reported and ignored.
    pub fn load(path: &Path) -> Self {
        match std::fs::read_to_string(path) {
            Ok(s) => Self::parse(&s).unwrap_or_else(|e| {
                eprintln!("mdviewer: ignoring invalid {}: {e}", path.display());
                Self::default()
            }),
            Err(_) => Self::default(),
        }
    }

    pub fn parse(json: &str) -> serde_json::Result<Self> {
        serde_json::from_str(json)
    }

    pub fn plugin_enabled(&self, name: &str, default: bool) -> bool {
        self.plugins.get(name).copied().unwrap_or(default)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plugins() {
        let s = Settings::parse(r#"{ "plugins": { "mermaid": true, "gfm": false } }"#).unwrap();
        assert!(s.plugin_enabled("mermaid", false));
        assert!(!s.plugin_enabled("gfm", true));
        assert!(s.plugin_enabled("zoom", true));
    }

    #[test]
    fn empty_and_unknown_fields_are_fine() {
        assert_eq!(Settings::parse("{}").unwrap(), Settings::default());
        assert!(Settings::parse(r#"{ "future": 1 }"#).is_ok());
    }

    #[test]
    fn missing_or_invalid_file_gives_defaults() {
        assert_eq!(
            Settings::load(Path::new("/no/such/settings.json")),
            Settings::default()
        );
        let p = std::env::temp_dir().join(format!("mdviewer-settings-{}.json", std::process::id()));
        std::fs::write(&p, "{ not json").unwrap();
        assert_eq!(Settings::load(&p), Settings::default());
        std::fs::remove_file(&p).unwrap();
    }
}
