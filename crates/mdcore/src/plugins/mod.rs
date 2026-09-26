//! Built-in rendering plugins.
//!
//! | plugin             | feature                                                   |
//! |--------------------|-----------------------------------------------------------|
//! | [`Gfm`]            | tables, task lists, strikethrough, footnotes, alerts      |
//! | [`HeadingAnchors`] | GitHub-style `id`s on headings so `#links` work           |
//! | [`LocalImages`]    | relative image paths → URLs the webview can load          |

mod gfm;
mod heading_anchors;
mod local_images;

pub use gfm::Gfm;
pub use heading_anchors::HeadingAnchors;
pub use local_images::LocalImages;
