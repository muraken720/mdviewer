//! Which files the UI may read and write.
//!
//! The webview is treated as untrusted: even if a document managed to run script, it must not be
//! able to read or overwrite arbitrary files. So the UI never passes a free-form path for writing:
//!
//! * A document can be opened only if the **user** chose it (command line, file dialog, drag and
//!   drop — see [`Session::allow`]) or if it is a relative link from the current document to
//!   another document file ([`Session::resolve_link`]).
//! * Saving, re-reading and polling always use the **current** document tracked here.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use mdcore::paths::{self, DOCUMENT_EXTENSIONS};

#[derive(Default)]
pub struct Session {
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    /// Files the user explicitly chose.
    allowed: HashSet<PathBuf>,
    /// The document being shown (set after it was read successfully).
    current: Option<PathBuf>,
}

impl Session {
    /// Record a file the user chose, so the UI may open it.
    pub fn allow(&self, path: PathBuf) {
        self.lock().allowed.insert(path);
    }

    /// Check that the UI may open `path` (a path previously passed to [`Session::allow`]).
    pub fn check_allowed(&self, path: &Path) -> Result<(), String> {
        if !is_document(path) {
            return Err(format!("Markdown ファイルではありません: {}", path.display()));
        }
        if self.lock().allowed.contains(path) {
            Ok(())
        } else {
            Err(format!("開く許可のないファイルです: {}", path.display()))
        }
    }

    /// Resolve a link found in the current document. Only plain relative paths to document files
    /// are accepted (no absolute paths, no network shares).
    pub fn resolve_link(&self, href: &str) -> Result<PathBuf, String> {
        let current = self.current()?;
        let dir = current.parent().unwrap_or(Path::new(""));
        match paths::resolve_relative(dir, href) {
            Some(path) if is_document(&path) => Ok(path),
            _ => Err(format!("このリンクは開けません: {href}")),
        }
    }

    /// Mark `path` as the document being shown (and allow re-opening it).
    pub fn set_current(&self, path: PathBuf) {
        let mut state = self.lock();
        state.allowed.insert(path.clone());
        state.current = Some(path);
    }

    pub fn current(&self) -> Result<PathBuf, String> {
        self.lock()
            .current
            .clone()
            .ok_or_else(|| "文書が開かれていません".to_string())
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        // A poisoned lock only means another command panicked; the state itself is still valid.
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

fn is_document(path: &Path) -> bool {
    paths::has_extension(path, DOCUMENT_EXTENSIONS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_user_chosen_documents_can_be_opened() {
        let s = Session::default();
        let doc = PathBuf::from("/home/u/a.md");
        assert!(s.check_allowed(&doc).is_err());
        s.allow(doc.clone());
        assert!(s.check_allowed(&doc).is_ok());
        assert!(s.check_allowed(Path::new("/home/u/b.md")).is_err());

        let exe = PathBuf::from("/home/u/a.exe");
        s.allow(exe.clone());
        assert!(s.check_allowed(&exe).is_err(), "not a document");
    }

    #[test]
    fn links_resolve_relative_to_the_current_document() {
        let s = Session::default();
        assert!(s.resolve_link("b.md").is_err(), "no current document");
        s.set_current(PathBuf::from("/home/u/docs/a.md"));
        assert_eq!(s.resolve_link("../b.md#x"), Ok(PathBuf::from("/home/u/b.md")));
        assert!(s.resolve_link("//evil/share/x.md").is_err());
        assert!(s.resolve_link("/etc/passwd.md").is_err());
        assert!(s.resolve_link("secret.txt.exe").is_err());
    }

    #[test]
    fn current_document_can_be_reopened() {
        let s = Session::default();
        let doc = PathBuf::from("/home/u/a.md");
        s.set_current(doc.clone());
        assert_eq!(s.current(), Ok(doc.clone()));
        assert!(s.check_allowed(&doc).is_ok());
    }
}
