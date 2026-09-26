use std::collections::HashSet;

use pulldown_cmark::{CowStr, Event, Tag, TagEnd};

use crate::{Context, Plugin};

/// Adds GitHub-style `id` attributes to headings (`## Hello World` → `id="hello-world"`),
/// so in-document links such as a generated table of contents work.
/// Explicit ids (`# Title {#custom}`) are kept.
#[derive(Default)]
pub struct HeadingAnchors;

impl Plugin for HeadingAnchors {
    fn name(&self) -> &'static str {
        "heading-anchors"
    }

    fn transform<'a>(&self, mut events: Vec<Event<'a>>, _: &mut Context) -> Vec<Event<'a>> {
        let mut used = HashSet::new();
        let mut open: Option<(usize, String)> = None;

        for i in 0..events.len() {
            match &events[i] {
                Event::Start(Tag::Heading { .. }) => open = Some((i, String::new())),
                Event::Text(t) | Event::Code(t) => {
                    if let Some((_, text)) = open.as_mut() {
                        text.push_str(t);
                    }
                }
                Event::End(TagEnd::Heading(_)) => {
                    let Some((start, text)) = open.take() else {
                        continue;
                    };
                    if let Event::Start(Tag::Heading { id, .. }) = &mut events[start] {
                        if id.is_none() {
                            *id = Some(CowStr::from(unique(slugify(&text), &mut used)));
                        }
                    }
                }
                _ => {}
            }
        }
        events
    }
}

/// GitHub-compatible slug: lowercase, spaces → `-`, punctuation removed, Unicode letters kept.
pub fn slugify(text: &str) -> String {
    text.trim()
        .to_lowercase()
        .chars()
        .filter_map(|c| match c {
            ' ' => Some('-'),
            c if c.is_alphanumeric() || c == '-' || c == '_' => Some(c),
            _ => None,
        })
        .collect()
}

fn unique(base: String, used: &mut HashSet<String>) -> String {
    let mut slug = base.clone();
    let mut n = 1;
    while !used.insert(slug.clone()) {
        slug = format!("{base}-{n}");
        n += 1;
    }
    slug
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Renderer;
    use std::path::Path;

    fn render(md: &str) -> String {
        Renderer::new()
            .with(HeadingAnchors)
            .render(md, Path::new("/"))
            .html
    }

    #[test]
    fn slugs() {
        assert_eq!(slugify("Hello, World!"), "hello-world");
        assert_eq!(slugify("1. 概要と目的"), "1-概要と目的");
        assert_eq!(slugify("a_b-c"), "a_b-c");
    }

    #[test]
    fn duplicate_headings_get_suffix() {
        let html = render("# A\n# A\n# A");
        assert!(html.contains(r#"<h1 id="a">"#));
        assert!(html.contains(r#"<h1 id="a-1">"#));
        assert!(html.contains(r#"<h1 id="a-2">"#));
    }

    #[test]
    fn inline_code_and_emphasis_are_included() {
        assert!(render("## Use `foo` *now*").contains(r#"id="use-foo-now""#));
    }
}
