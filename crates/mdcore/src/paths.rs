//! Filesystem path helpers (lexical only; no filesystem access).
//!
//! References found in a document (image sources, link targets) are untrusted. They are only
//! ever resolved with [`resolve_relative`], which refuses anything that is not a plain relative
//! path: no drive letters, no root, and in particular no UNC paths (`\\host\share`,
//! `//host/share`), which would make Windows connect to a remote SMB server and send the user's
//! credentials.

use std::path::{Component, Path, PathBuf};

use crate::url::percent_decode;

/// File extensions the viewer may load as images.
pub const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"];

/// File extensions the viewer opens as documents.
pub const DOCUMENT_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];

/// Resolve a reference from a document (percent-encoded, possibly with `#fragment`/`?query`)
/// against `base_dir`. Returns `None` unless it is a plain relative path.
pub fn resolve_relative(base_dir: &Path, reference: &str) -> Option<PathBuf> {
    let r = reference.split(['#', '?']).next().unwrap_or_default();
    let r = percent_decode(r);
    if !is_plain_relative(&r) {
        return None;
    }
    Some(normalize(&base_dir.join(r)))
}

/// Relative path without scheme, drive, root or UNC prefix (on any platform).
fn is_plain_relative(r: &str) -> bool {
    !r.is_empty()
        && !r.starts_with(['/', '\\'])
        && !r.contains(':') // drive letters (`C:x`), URL schemes, NTFS streams
        && Path::new(r)
            .components()
            .all(|c| !matches!(c, Component::Prefix(_) | Component::RootDir))
}

/// Remove `.` and `..` components without touching the filesystem.
pub fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            c => out.push(c),
        }
    }
    out
}

/// True if `path` has one of `extensions` (case-insensitive).
pub fn has_extension(path: &Path, extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| extensions.iter().any(|x| x.eq_ignore_ascii_case(e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_relative() {
        assert_eq!(
            resolve_relative(Path::new("/a/b"), "../d.md#sec"),
            Some(PathBuf::from("/a/d.md"))
        );
        assert_eq!(
            resolve_relative(Path::new("/a"), "./x%20y.png?v=1"),
            Some(PathBuf::from("/a/x y.png"))
        );
    }

    #[test]
    fn refuses_anything_but_plain_relative_paths() {
        for r in [
            "/etc/passwd",
            "//host/share/a.png",
            "\\\\host\\share\\a.png",
            "%5C%5Chost%5Cshare%5Ca.png", // percent-encoded UNC
            "C:/Users/a.png",
            "C:a.png",
            "https://example.com/a.png",
            "file:///c/a.png",
            "data:image/png;base64,xx",
            "#fragment",
            "",
        ] {
            assert_eq!(resolve_relative(Path::new("/doc"), r), None, "{r}");
        }
    }

    #[test]
    fn normalizes() {
        assert_eq!(normalize(Path::new("/a/./b/../c")), PathBuf::from("/a/c"));
    }

    #[test]
    fn extensions() {
        assert!(has_extension(Path::new("a/B.PNG"), IMAGE_EXTENSIONS));
        assert!(!has_extension(Path::new("id_rsa"), IMAGE_EXTENSIONS));
        assert!(!has_extension(Path::new("a.png.exe"), IMAGE_EXTENSIONS));
        assert!(has_extension(Path::new("README.md"), DOCUMENT_EXTENSIONS));
    }
}
