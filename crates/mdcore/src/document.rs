//! Reading and writing Markdown files.
//!
//! Text is exposed with `\n` line endings. The original encoding details (BOM, CRLF) are
//! detected on every read/save so that saving never rewrites every line of a Windows file.

use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const BOM: &[u8] = b"\xEF\xBB\xBF";

/// A Markdown source file.
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub path: PathBuf,
    /// UTF-8 text with `\n` line endings and no BOM (invalid bytes are replaced).
    pub text: String,
    /// Modification time in milliseconds since the Unix epoch (0 if unknown).
    pub mtime: u64,
}

/// On-disk encoding details that are preserved when saving.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Format {
    pub bom: bool,
    pub crlf: bool,
}

impl Document {
    pub fn read(path: impl Into<PathBuf>) -> io::Result<Self> {
        let path = path.into();
        let bytes = std::fs::read(&path)?;
        Ok(Self {
            text: decode(&bytes).0,
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

/// Write `text` (with `\n` line endings) to `path`, keeping the existing file's BOM and
/// line endings. Returns the new modification time.
pub fn save(path: &Path, text: &str) -> io::Result<u64> {
    let format = std::fs::read(path).map(|b| decode(&b).1).unwrap_or_default();
    std::fs::write(path, encode(text, format))?;
    Ok(mtime(path))
}

/// Modification time in milliseconds since the Unix epoch, or 0 if unavailable.
pub fn mtime(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

/// Bytes → normalized text and the detected format.
pub fn decode(bytes: &[u8]) -> (String, Format) {
    let bom = bytes.starts_with(BOM);
    let text = String::from_utf8_lossy(if bom { &bytes[BOM.len()..] } else { bytes });
    let crlf = text.contains("\r\n");
    let text = if crlf {
        text.replace("\r\n", "\n")
    } else {
        text.into_owned()
    };
    (text, Format { bom, crlf })
}

/// Normalized text → bytes in the given format.
pub fn encode(text: &str, format: Format) -> Vec<u8> {
    let text = text.replace("\r\n", "\n");
    let text = if format.crlf {
        text.replace('\n', "\r\n")
    } else {
        text
    };
    let mut out = Vec::with_capacity(text.len() + 3);
    if format.bom {
        out.extend_from_slice(BOM);
    }
    out.extend_from_slice(text.as_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mdcore-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reads_and_normalizes() {
        let dir = temp_dir("read");
        let path = dir.join("a.md");
        std::fs::write(&path, b"\xEF\xBB\xBF# hi\r\nx").unwrap();

        let doc = Document::read(&path).unwrap();
        assert_eq!(doc.text, "# hi\nx");
        assert_eq!(doc.name(), "a.md");
        assert_eq!(doc.dir(), dir);
        assert!(doc.mtime > 0);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn save_preserves_bom_and_crlf() {
        let dir = temp_dir("save");
        let path = dir.join("a.md");
        std::fs::write(&path, b"\xEF\xBB\xBFold\r\n").unwrap();
        assert!(save(&path, "new\nline\n").unwrap() > 0);
        assert_eq!(std::fs::read(&path).unwrap(), b"\xEF\xBB\xBFnew\r\nline\r\n");

        let lf = dir.join("b.md");
        std::fs::write(&lf, b"old\n").unwrap();
        save(&lf, "new\n").unwrap();
        assert_eq!(std::fs::read(&lf).unwrap(), b"new\n");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn save_creates_new_file_as_plain_utf8() {
        let dir = temp_dir("new");
        let path = dir.join("n.md");
        save(&path, "x\n").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"x\n");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn encode_decode_roundtrip() {
        for format in [
            Format::default(),
            Format {
                bom: true,
                crlf: true,
            },
        ] {
            let bytes = encode("a\nb", format);
            assert_eq!(decode(&bytes), ("a\nb".to_string(), format));
        }
    }

    #[test]
    fn missing_file_is_error() {
        assert!(Document::read("/definitely/not/here.md").is_err());
        assert_eq!(mtime(Path::new("/definitely/not/here.md")), 0);
    }
}
