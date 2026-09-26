//! OS-specific bits.

use std::path::Path;

use mdcore::url::encode_component;

/// URL for a local file served through Tauri's asset protocol
/// (mirrors `convertFileSrc` in `@tauri-apps/api`).
pub fn asset_url(path: &Path) -> String {
    let enc = encode_component(&path.to_string_lossy());
    if cfg!(windows) {
        format!("http://asset.localhost/{enc}")
    } else {
        format!("asset://localhost/{enc}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_url_is_encoded() {
        let u = asset_url(Path::new("/a b/日.png"));
        assert!(u.ends_with("localhost/%2Fa%20b%2F%E6%97%A5.png"), "{u}");
    }
}
