//! GUI-independent core of mdviewer.
//!
//! * [`Renderer`] turns Markdown into HTML through a pipeline of [`Plugin`]s.
//! * [`plugins`] contains the built-in plugins.
//! * [`document`], [`paths`] and [`url`] are small, pure helpers used by the app shell.
//!
//! Nothing in this crate depends on Tauri, so everything here is unit-testable with `cargo test`.

#![forbid(unsafe_code)]

pub mod document;
pub mod paths;
pub mod pipeline;
pub mod plugins;
pub mod url;

pub use pipeline::{Context, Plugin, Rendered, Renderer};
