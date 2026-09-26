//! Reading Markdown files from disk.

use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// A Markdown source file.
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub path: PathBuf,
    /// UTF-8 text with any BOM removed (invalid bytes are replaced).
    pub text: String,
    /// Modification time in milliseconds since the Unix epoch (0 if unknown).
    pub mtime: u64,
}

impl Document {
    pub fn read(path: impl Into<PathBuf>) -> io::Result<Self> {
        let path = path.into();
        let bytes = std::fs::read(&path)?;
        Ok(Self {
            text: decode(&bytes),
            mtime: mtime(&path),
            path,
        })
    }

    /// Directory containing the document.
    pub fn dir(&self) -> &Path {
        self.path.parent().unwrap_or(Path::new(""))
    }

    /// File name for display (e.g. the window title).
    pub fn name(&self) -> String {
        self.path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
}

/// Modification time in milliseconds since the Unix epoch, or 0 if unavailable.
pub fn mtime(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

fn decode(bytes: &[u8]) -> String {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    String::from_utf8_lossy(bytes).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_and_strips_bom() {
        let dir = std::env::temp_dir().join(format!("mdcore-doc-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("a.md");
        std::fs::write(&path, b"\xEF\xBB\xBF# hi").unwrap();

        let doc = Document::read(&path).unwrap();
        assert_eq!(doc.text, "# hi");
        assert_eq!(doc.name(), "a.md");
        assert_eq!(doc.dir(), dir);
        assert!(doc.mtime > 0);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn missing_file_is_error() {
        assert!(Document::read("/definitely/not/here.md").is_err());
        assert_eq!(mtime(Path::new("/definitely/not/here.md")), 0);
    }
}
