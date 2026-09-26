//! Errors returned by IPC commands. They are serialised as `{ "code": "...", "detail": "..." }`
//! so the UI can show a translated message (see `ui/src/i18n`).

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "code", content = "detail", rename_all = "kebab-case")]
pub enum CommandError {
    /// The file was not chosen by the user (dialog, drop, command line).
    NotAllowed(String),
    /// Not a Markdown/text file.
    NotDocument(String),
    /// A link that is not a plain relative path to a document.
    LinkRefused(String),
    /// The document id is unknown (e.g. the tab was closed).
    UnknownDocument,
    /// Reading or writing failed.
    Io(String),
    /// A URL that may not be opened.
    InvalidUrl(String),
}

pub type CommandResult<T> = Result<T, CommandError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialises_with_code_and_detail() {
        let json = serde_json::to_string(&CommandError::NotAllowed("a.md".into())).unwrap();
        assert_eq!(json, r#"{"code":"not-allowed","detail":"a.md"}"#);
        let json = serde_json::to_string(&CommandError::UnknownDocument).unwrap();
        assert_eq!(json, r#"{"code":"unknown-document"}"#);
    }
}
