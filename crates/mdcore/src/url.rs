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

/// `http:`, `https:` or `mailto:` — the only links handed to the OS.
pub fn is_web_url(s: &str) -> bool {
    let l = s.trim_start().to_ascii_lowercase();
    l.starts_with("http://") || l.starts_with("https://") || l.starts_with("mailto:")
}

/// A reference to a local file relative to the document (not a URL, data URI or fragment).
pub fn is_local_ref(s: &str) -> bool {
    !(s.is_empty() || s.starts_with('#') || s.starts_with("data:") || s.contains("://") || is_web_url(s))
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
    fn classify() {
        assert!(is_web_url("HTTPS://x"));
        assert!(is_web_url("mailto:a@b"));
        assert!(!is_web_url("file:///c"));
        assert!(!is_web_url("javascript:alert(1)"));
        assert!(is_local_ref("img/a.png"));
        assert!(is_local_ref("../a.md#x"));
        assert!(!is_local_ref("#x"));
        assert!(!is_local_ref("https://x/a.png"));
        assert!(!is_local_ref("data:image/png;base64,xx"));
    }
}
