//! Filesystem path helpers (lexical only; no filesystem access).

use std::path::{Component, Path, PathBuf};

use crate::url::percent_decode;

/// Resolve a Markdown reference (possibly relative, percent-encoded, with `#fragment`/`?query`)
/// against the directory `base_dir`.
pub fn resolve(base_dir: &Path, reference: &str) -> PathBuf {
    let r = reference.split(['#', '?']).next().unwrap_or_default();
    let r = percent_decode(r);
    let p = Path::new(&r);
    normalize(&if p.is_relative() {
        base_dir.join(p)
    } else {
        p.to_path_buf()
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_relative() {
        assert_eq!(
            resolve(Path::new("/a/b"), "../d.md#sec"),
            PathBuf::from("/a/d.md")
        );
        assert_eq!(
            resolve(Path::new("/a"), "./x%20y.png?v=1"),
            PathBuf::from("/a/x y.png")
        );
    }

    #[test]
    fn keeps_absolute() {
        assert_eq!(resolve(Path::new("/a"), "/x/y.md"), PathBuf::from("/x/y.md"));
    }

    #[test]
    fn normalizes() {
        assert_eq!(normalize(Path::new("/a/./b/../c")), PathBuf::from("/a/c"));
    }
}
