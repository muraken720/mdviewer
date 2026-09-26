use std::borrow::Cow;
use std::collections::HashSet;

use pulldown_cmark::Options;

use crate::Plugin;

/// TeX math: `$inline$`, `$$display$$`, and the LaTeX delimiters `\(inline\)` / `\[display\]`
/// that many AI tools emit. The HTML contains `<span class="math math-inline|math-display">`
/// with the TeX source; the UI typesets it (KaTeX).
///
/// `\(`…`\)` and `\[`…`\]` are rewritten to `$`…`$` / `$$`…`$$` before parsing, except inside
/// code spans and fenced code blocks. `\[…\]` is only converted when its content looks like
/// TeX, because `\[1\]` is also the usual way to write literal brackets in Markdown.
///
/// A `$` that cannot pair up under Pandoc's rules (the closing `$` must follow a non-space and
/// must not be followed by a digit) is escaped, so prices such as `$5と$10` stay text.
pub struct Math;

impl Plugin for Math {
    fn name(&self) -> &'static str {
        "math"
    }

    fn parser_options(&self) -> Options {
        Options::ENABLE_MATH
    }

    fn preprocess<'a>(&self, markdown: Cow<'a, str>) -> Cow<'a, str> {
        if !markdown.contains('$') && !markdown.contains("\\(") && !markdown.contains("\\[") {
            return markdown;
        }
        Cow::Owned(convert_latex_delimiters(&markdown))
    }
}

/// Rewrite `\(…\)` → `$…$` and `\[…\]` → `$$…$$` outside code.
pub fn convert_latex_delimiters(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let mut fence: Option<String> = None; // opening fence marker while inside a code block
    let mut pending = String::new(); // prose accumulated since the last code block

    for line in src.split_inclusive('\n') {
        let trimmed = line.trim_start_matches(' ');
        let indent = line.len() - trimmed.len();
        let marker: String = trimmed.chars().take_while(|&c| c == '`' || c == '~').collect();
        let is_fence =
            indent <= 3 && marker.len() >= 3 && marker.chars().all(|c| c == marker.chars().next().unwrap());

        match &fence {
            Some(open) => {
                out.push_str(line);
                if is_fence && marker.starts_with(open.as_str()) && trimmed[marker.len()..].trim().is_empty()
                {
                    fence = None;
                }
            }
            None if is_fence => {
                out.push_str(&convert_prose(&std::mem::take(&mut pending)));
                out.push_str(line);
                fence = Some(marker);
            }
            None => pending.push_str(line),
        }
    }
    out.push_str(&convert_prose(&pending));
    out
}

/// Convert delimiters in text that contains no fenced code (inline code spans are skipped).
fn convert_prose(text: &str) -> String {
    let b = text.as_bytes();
    let unpaired = unpaired_dollars(text);
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    let mut copied = 0;

    while i < b.len() {
        match b[i] {
            b'$' if unpaired.contains(&i) => {
                out.push_str(&text[copied..i]);
                out.push_str("\\$");
                i += 1;
                copied = i;
            }
            b'`' => {
                // Skip a code span: a run of n backticks up to the next run of exactly n.
                let n = b[i..].iter().take_while(|&&c| c == b'`').count();
                let close = find_backtick_run(b, i + n, n);
                i = close.map_or(i + n, |c| c + n);
            }
            b'\\' if i + 1 < b.len() && (b[i + 1] == b'(' || b[i + 1] == b'[') => {
                let display = b[i + 1] == b'[';
                let closing = if display { "\\]" } else { "\\)" };
                let start = i + 2;
                let limit = if display {
                    text.len()
                } else {
                    paragraph_end(text, start)
                };
                match text[start..limit].find(closing) {
                    Some(rel) if !display || looks_like_tex(&text[start..start + rel]) => {
                        let inner = text[start..start + rel].trim();
                        let delim = if display { "$$" } else { "$" };
                        out.push_str(&text[copied..i]);
                        out.push_str(delim);
                        out.push_str(inner);
                        out.push_str(delim);
                        i = start + rel + 2;
                        copied = i;
                    }
                    _ => i += 2,
                }
            }
            b'\\' => i += 2, // any other escape: skip the escaped character
            _ => i += 1,
        }
    }
    out.push_str(&text[copied.min(text.len())..]);
    out
}

/// Positions of single `$` that cannot be inline-math delimiters (outside code spans).
fn unpaired_dollars(text: &str) -> HashSet<usize> {
    let b = text.as_bytes();
    let mut unpaired = HashSet::new();
    let mut opener: Option<usize> = None;
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'`' => {
                let n = b[i..].iter().take_while(|&&c| c == b'`').count();
                i = find_backtick_run(b, i + n, n).map_or(i + n, |c| c + n);
            }
            b'\\' => i += 2,
            b'\n' if b.get(i + 1) == Some(&b'\n') => {
                unpaired.extend(opener.take()); // math does not span paragraphs
                i += 1;
            }
            b'$' if b.get(i + 1) == Some(&b'$') => {
                i += b[i..].iter().take_while(|&&c| c == b'$').count(); // $$ display math
            }
            b'$' => {
                let prev = if i > 0 { b[i - 1] } else { b' ' };
                let next = b.get(i + 1).copied();
                let can_close = opener.is_some()
                    && !prev.is_ascii_whitespace()
                    && !next.is_some_and(|c| c.is_ascii_digit());
                if can_close {
                    opener = None;
                } else {
                    unpaired.extend(opener.take());
                    if next.is_some_and(|c| !c.is_ascii_whitespace()) {
                        opener = Some(i);
                    } else {
                        unpaired.insert(i);
                    }
                }
                i += 1;
            }
            _ => i += 1,
        }
    }
    unpaired.extend(opener);
    unpaired
}

/// Heuristic for `\[…\]`: TeX commands, sub/superscripts, braces or operators, or several lines.
fn looks_like_tex(inner: &str) -> bool {
    inner.contains('\n') || inner.chars().any(|c| "\\^_{}=+<>".contains(c))
}

fn find_backtick_run(b: &[u8], from: usize, n: usize) -> Option<usize> {
    let mut i = from;
    while i < b.len() {
        if b[i] == b'`' {
            let run = b[i..].iter().take_while(|&&c| c == b'`').count();
            if run == n {
                return Some(i);
            }
            i += run;
        } else {
            i += 1;
        }
    }
    None
}

/// End of the paragraph containing `from` (the next blank line), for inline math.
fn paragraph_end(text: &str, from: usize) -> usize {
    text[from..].find("\n\n").map_or(text.len(), |p| from + p)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Renderer;
    use std::path::Path;

    fn render(md: &str) -> String {
        Renderer::new().with(Math).render(md, Path::new("/")).html
    }

    #[test]
    fn dollar_math() {
        assert!(render("a $x^2$ b").contains(r#"<span class="math math-inline">x^2</span>"#));
        assert!(render("$$\n\\int f\n$$").contains(r#"<span class="math math-display">"#));
    }

    #[test]
    fn currency_is_not_math() {
        assert_eq!(render("costs $5 and $10"), "<p>costs $5 and $10</p>\n");
        assert_eq!(render("価格は$5と$10です"), "<p>価格は$5と$10です</p>\n");
        assert_eq!(render("cost $x$1"), "<p>cost $x$1</p>\n");
        assert_eq!(render("only $5"), "<p>only $5</p>\n");
    }

    #[test]
    fn valid_inline_math_still_works() {
        assert!(render("$2x$ と $y$").contains(r#"<span class="math math-inline">2x</span>"#));
        assert!(render("$y$です").contains(r#"<span class="math math-inline">y</span>"#));
        assert!(render("`$5` と $$x$$").contains("<code>$5</code>"));
        assert!(render("$a$\n\n$b$").matches("math-inline").count() == 2);
    }

    #[test]
    fn latex_delimiters() {
        assert_eq!(convert_latex_delimiters(r"a \( x^2 \) b"), "a $x^2$ b");
        assert_eq!(
            convert_latex_delimiters("\\[\n\\frac{a}{b}\n\\]\n"),
            "$$\\frac{a}{b}$$\n"
        );
        assert!(render(r"a \(x\) b").contains(r#"<span class="math math-inline">x</span>"#));
    }

    #[test]
    fn code_is_left_alone() {
        let md = "`\\(x\\)` and\n```\n\\[y\\]\n```\n\\(z\\)";
        assert_eq!(
            convert_latex_delimiters(md),
            "`\\(x\\)` and\n```\n\\[y\\]\n```\n$z$"
        );
    }

    #[test]
    fn unmatched_and_escaped_are_left_alone() {
        assert_eq!(convert_latex_delimiters(r"just \( open"), r"just \( open");
        assert_eq!(convert_latex_delimiters(r"\\(x\\)"), r"\\(x\\)");
        assert_eq!(convert_latex_delimiters("a \\(x\n\ny\\)"), "a \\(x\n\ny\\)");
    }

    #[test]
    fn escaped_brackets_that_are_not_tex_stay_literal() {
        assert_eq!(
            convert_latex_delimiters(r"see \[1\] and \[注\]"),
            r"see \[1\] and \[注\]"
        );
        assert_eq!(convert_latex_delimiters(r"\[E = mc^2\]"), "$$E = mc^2$$");
    }

    #[test]
    fn no_delimiters_borrows() {
        assert!(matches!(
            Math.preprocess(Cow::Borrowed("plain")),
            Cow::Borrowed(_)
        ));
    }
}
