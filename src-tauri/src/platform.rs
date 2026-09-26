//! OS-specific bits.

use std::io;
use std::path::Path;
use std::process::Command;

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

/// Open `url` with the default handler. The caller must validate `url`.
pub fn open_in_browser(url: &str) -> io::Result<()> {
    #[cfg(windows)]
    let mut cmd = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut c = Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW);
        c
    };
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut c = Command::new("xdg-open");
        c.arg(url);
        c
    };
    cmd.spawn().map(|_| ())
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
