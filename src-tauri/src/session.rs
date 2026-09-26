//! Which files the UI may read and write.
//!
//! The webview is treated as untrusted: even if a document managed to run script, it must not be
//! able to read or overwrite arbitrary files. So the UI never passes a free-form path for writing:
//!
//! * A document can be opened only if the **user** chose it (command line, file dialog, drag and
//!   drop, a second launch — see [`Session::allow`]) or if it is a relative link from an open
//!   document to another document file ([`Session::resolve_link`]).
//! * Every opened document gets a [`DocId`]. Saving, re-reading and polling take that id, never
//!   a path, so they can only touch documents that were opened this way.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use mdcore::paths::{self, DOCUMENT_EXTENSIONS};

use crate::error::{CommandError, CommandResult};

/// Handle of an open document (one per tab page).
pub type DocId = u32;

#[derive(Default)]
pub struct Session {
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    /// Files the user explicitly chose, plus every document opened so far (so history can
    /// return to them).
    allowed: HashSet<PathBuf>,
    /// Open documents.
    docs: HashMap<DocId, PathBuf>,
    next_id: DocId,
}

impl Session {
    /// Record a file the user chose, so the UI may open it.
    pub fn allow(&self, path: PathBuf) {
        self.lock().allowed.insert(path);
    }

    /// Check that the UI may open `path`.
    pub fn check_allowed(&self, path: &Path) -> CommandResult<()> {
        if !is_document(path) {
            return Err(CommandError::NotDocument(path.display().to_string()));
        }
        if self.lock().allowed.contains(path) {
            Ok(())
        } else {
            Err(CommandError::NotAllowed(path.display().to_string()))
        }
    }

    /// Resolve a link found in document `from`. Only plain relative paths to document files are
    /// accepted (no absolute paths, no network shares).
    pub fn resolve_link(&self, from: DocId, href: &str) -> CommandResult<PathBuf> {
        let current = self.path(from)?;
        let dir = current.parent().unwrap_or(Path::new(""));
        match paths::resolve_relative(dir, href) {
            Some(path) if is_document(&path) => Ok(path),
            _ => Err(CommandError::LinkRefused(href.to_string())),
        }
    }

    /// Register an opened document and return its id.
    pub fn register(&self, path: PathBuf) -> DocId {
        let mut state = self.lock();
        state.next_id += 1;
        let id = state.next_id;
        state.allowed.insert(path.clone());
        state.docs.insert(id, path);
        id
    }

    /// Path of an open document.
    pub fn path(&self, id: DocId) -> CommandResult<PathBuf> {
        self.lock()
            .docs
            .get(&id)
            .cloned()
            .ok_or(CommandError::UnknownDocument)
    }

    /// Forget a document (its tab was closed or navigated away).
    pub fn close(&self, id: DocId) {
        self.lock().docs.remove(&id);
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
        assert_eq!(
            s.check_allowed(&doc),
            Err(CommandError::NotAllowed("/home/u/a.md".into()))
        );
        s.allow(doc.clone());
        assert!(s.check_allowed(&doc).is_ok());
        assert!(s.check_allowed(Path::new("/home/u/b.md")).is_err());

        let exe = PathBuf::from("/home/u/a.exe");
        s.allow(exe.clone());
        assert!(matches!(s.check_allowed(&exe), Err(CommandError::NotDocument(_))));
    }

    #[test]
    fn documents_get_ids_and_can_be_reopened_later() {
        let s = Session::default();
        let a = s.register(PathBuf::from("/home/u/a.md"));
        let b = s.register(PathBuf::from("/home/u/b.md"));
        assert_ne!(a, b);
        assert_eq!(s.path(a), Ok(PathBuf::from("/home/u/a.md")));
        s.close(a);
        assert_eq!(s.path(a), Err(CommandError::UnknownDocument));
        // Back/forward history re-opens by path: still allowed after the tab page was closed.
        assert!(s.check_allowed(Path::new("/home/u/a.md")).is_ok());
    }

    #[test]
    fn links_resolve_relative_to_their_document() {
        let s = Session::default();
        assert_eq!(s.resolve_link(1, "b.md"), Err(CommandError::UnknownDocument));
        let id = s.register(PathBuf::from("/home/u/docs/a.md"));
        assert_eq!(s.resolve_link(id, "../b.md#x"), Ok(PathBuf::from("/home/u/b.md")));
        for bad in ["//evil/share/x.md", "/etc/passwd.md", "secret.txt.exe"] {
            assert!(
                matches!(s.resolve_link(id, bad), Err(CommandError::LinkRefused(_))),
                "{bad}"
            );
        }
    }
}
