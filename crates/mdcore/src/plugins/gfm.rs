use pulldown_cmark::Options;

use crate::Plugin;

/// GitHub Flavored Markdown extensions: tables, task lists, strikethrough, footnotes
/// and `> [!NOTE]` alerts.
pub struct Gfm;

impl Plugin for Gfm {
    fn name(&self) -> &'static str {
        "gfm"
    }

    fn parser_options(&self) -> Options {
        Options::ENABLE_TABLES
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_STRIKETHROUGH
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_GFM
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Renderer;
    use std::path::Path;

    #[test]
    fn renders_gfm() {
        let md = "|a|b|\n|-|-|\n|1|2|\n\n- [x] done\n\n~~s~~\n\n> [!NOTE]\n> n\n\nx[^1]\n\n[^1]: f";
        let html = Renderer::new().with(Gfm).render(md, Path::new("/")).html;
        assert!(html.contains("<table>"));
        assert!(html.contains(r#"type="checkbox""#));
        assert!(html.contains("<del>s</del>"));
        assert!(html.contains("markdown-alert-note"));
        assert!(html.contains("footnote-definition"));
    }
}
