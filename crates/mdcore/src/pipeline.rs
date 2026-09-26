//! Markdown rendering pipeline.
//!
//! ```text
//! markdown ──parse──▶ events ──plugin 1──▶ … ──plugin N──▶ events ──push_html──▶ HTML
//! ```
//!
//! Parser options are the union of what each plugin requests, so removing a plugin
//! removes its feature entirely.

use std::path::{Path, PathBuf};

use pulldown_cmark::{Event, Options, Parser};

/// A compile-time extension of the rendering pipeline.
///
/// Plugins are registered with [`Renderer::with`] and run in registration order.
pub trait Plugin: Send + Sync {
    /// Short identifier, used in logs and docs.
    fn name(&self) -> &'static str;

    /// Parser features this plugin needs (e.g. tables).
    fn parser_options(&self) -> Options {
        Options::empty()
    }

    /// Rewrite the event stream. The default implementation passes events through.
    fn transform<'a>(&self, events: Vec<Event<'a>>, _ctx: &mut Context) -> Vec<Event<'a>> {
        events
    }
}

/// Per-render state shared between plugins.
#[derive(Debug, Default)]
pub struct Context {
    /// Directory of the document being rendered; relative references resolve against it.
    pub base_dir: PathBuf,
    /// Local files the rendered HTML refers to (the shell grants the webview access to them).
    pub assets: Vec<PathBuf>,
}

/// Output of [`Renderer::render`].
#[derive(Debug, Default, PartialEq)]
pub struct Rendered {
    pub html: String,
    pub assets: Vec<PathBuf>,
}

/// An ordered list of plugins.
#[derive(Default)]
pub struct Renderer {
    plugins: Vec<Box<dyn Plugin>>,
}

impl Renderer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Append a plugin to the pipeline.
    pub fn with(mut self, plugin: impl Plugin + 'static) -> Self {
        self.plugins.push(Box::new(plugin));
        self
    }

    /// Names of the registered plugins, in order.
    pub fn plugin_names(&self) -> Vec<&'static str> {
        self.plugins.iter().map(|p| p.name()).collect()
    }

    pub fn render(&self, markdown: &str, base_dir: &Path) -> Rendered {
        let options = self
            .plugins
            .iter()
            .fold(Options::empty(), |o, p| o | p.parser_options());
        let mut ctx = Context {
            base_dir: base_dir.to_path_buf(),
            assets: Vec::new(),
        };

        let mut events: Vec<Event> = Parser::new_ext(markdown, options).collect();
        for plugin in &self.plugins {
            events = plugin.transform(events, &mut ctx);
        }

        let mut html = String::with_capacity(markdown.len() * 3 / 2);
        pulldown_cmark::html::push_html(&mut html, events.into_iter());
        Rendered {
            html,
            assets: ctx.assets,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pulldown_cmark::CowStr;

    struct Upper;
    impl Plugin for Upper {
        fn name(&self) -> &'static str {
            "upper"
        }
        fn transform<'a>(&self, events: Vec<Event<'a>>, _: &mut Context) -> Vec<Event<'a>> {
            events
                .into_iter()
                .map(|e| match e {
                    Event::Text(t) => Event::Text(CowStr::from(t.to_uppercase())),
                    e => e,
                })
                .collect()
        }
    }

    struct Tables;
    impl Plugin for Tables {
        fn name(&self) -> &'static str {
            "tables"
        }
        fn parser_options(&self) -> Options {
            Options::ENABLE_TABLES
        }
    }

    #[test]
    fn empty_renderer_is_commonmark() {
        let r = Renderer::new().render("# hi", Path::new("/"));
        assert_eq!(r.html, "<h1>hi</h1>\n");
        assert!(r.assets.is_empty());
    }

    #[test]
    fn plugins_transform_in_order() {
        let r = Renderer::new().with(Upper).render("hi", Path::new("/"));
        assert_eq!(r.html, "<p>HI</p>\n");
    }

    #[test]
    fn parser_options_come_from_plugins() {
        let md = "|a|\n|-|\n|1|";
        assert!(!Renderer::new()
            .render(md, Path::new("/"))
            .html
            .contains("<table>"));
        assert!(Renderer::new()
            .with(Tables)
            .render(md, Path::new("/"))
            .html
            .contains("<table>"));
    }

    #[test]
    fn plugin_names_are_listed() {
        assert_eq!(
            Renderer::new().with(Tables).with(Upper).plugin_names(),
            ["tables", "upper"]
        );
    }
}
