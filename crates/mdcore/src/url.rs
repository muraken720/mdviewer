//! URL helpers (percent-encoding and link classification).

/// Decode `%XX` sequences; invalid sequences are kept as-is.
pub fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let hex = |c: u8| (c as char).to_digit(16);
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Same encoding as JavaScript's `encodeURIComponent`.
pub fn encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for &b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// True for `http://host…`, `https://host…` and `mailto:…` URLs — the only links handed to
/// the OS. Rejects whitespace, control characters and quotes anywhere, so the string can be
/// passed to the OS as a single, unambiguous argument.
pub fn is_web_url(s: &str) -> bool {
    if s.is_empty()
        || s.chars()
            .any(|c| c.is_whitespace() || c.is_control() || "\"<>\\`".contains(c))
    {
        return false;
    }
    let lower = s.to_ascii_lowercase();
    let has_host = |rest: &str| !rest.is_empty() && !rest.starts_with(['/', '?', '#']);
    if let Some(rest) = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
    {
        return has_host(rest);
    }
    lower.strip_prefix("mailto:").is_some_and(|rest| !rest.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode() {
        assert_eq!(percent_decode("a%20b%E6%97%A5"), "a b日");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("%zz"), "%zz");
        assert_eq!(percent_decode("日本%2"), "日本%2");
    }

    #[test]
    fn encode_matches_js() {
        assert_eq!(
            encode_component("C:\\a b\\日.png"),
            "C%3A%5Ca%20b%5C%E6%97%A5.png"
        );
        assert_eq!(encode_component("-_.!~*'()"), "-_.!~*'()");
    }

    #[test]
    fn web_urls() {
        assert!(is_web_url("HTTPS://example.com/a?b=c#d"));
        assert!(is_web_url("http://localhost:8080"));
        assert!(is_web_url("mailto:a@example.com"));
        for bad in [
            "",
            "file:///c",
            "javascript:alert(1)",
            " https://x",
            "https://x y",
            "https://x\"y",
            "https://x\n",
            "https:///path",
            "https://",
            "mailto:",
            "ms-settings:",
        ] {
            assert!(!is_web_url(bad), "{bad:?}");
        }
    }
}
