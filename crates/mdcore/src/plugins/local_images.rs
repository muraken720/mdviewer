use std::path::Path;

use pulldown_cmark::{CowStr, Event, Tag};

use crate::paths::{self, IMAGE_EXTENSIONS};
use crate::{Context, Plugin};

type UrlMapper = Box<dyn Fn(&Path) -> String + Send + Sync>;

/// Rewrites relative image references (`![](img/a.png)`) to URLs the webview can load,
/// and records each file in [`Context::assets`] so the shell can grant access to it.
///
/// Only plain relative paths with an image extension are accepted (see [`paths`]); anything else
/// is left untouched and simply does not load. A document therefore cannot make the app grant
/// access to arbitrary files (`![](../../.ssh/id_rsa)`) or reach network shares.
///
/// The URL scheme is platform/shell specific, so it is injected as `to_url`.
pub struct LocalImages {
    to_url: UrlMapper,
}

impl LocalImages {
    pub fn new(to_url: impl Fn(&Path) -> String + Send + Sync + 'static) -> Self {
        Self {
            to_url: Box::new(to_url),
        }
    }
}

impl Plugin for LocalImages {
    fn name(&self) -> &'static str {
        "local-images"
    }

    fn transform<'a>(&self, events: Vec<Event<'a>>, ctx: &mut Context) -> Vec<Event<'a>> {
        events
            .into_iter()
            .map(|ev| match ev {
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                }) => {
                    let dest_url = match paths::resolve_relative(&ctx.base_dir, &dest_url) {
                        Some(file) if paths::has_extension(&file, IMAGE_EXTENSIONS) => {
                            let url = CowStr::from((self.to_url)(&file));
                            ctx.assets.push(file);
                            url
                        }
                        _ => dest_url,
                    };
                    Event::Start(Tag::Image {
                        link_type,
                        dest_url,
                        title,
                        id,
                    })
                }
                ev => ev,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Renderer;
    use std::path::PathBuf;

    #[test]
    fn rewrites_relative_images_only() {
        let r = Renderer::new()
            .with(LocalImages::new(|p| format!("asset:{}", p.display())))
            .render(
                "![a](../img/a%20b.png) ![b](https://x/y.png)",
                Path::new("/doc/sub"),
            );
        assert_eq!(r.assets, vec![PathBuf::from("/doc/img/a b.png")]);
        assert!(r.html.contains(r#"src="asset:/doc/img/a%20b.png""#));
        assert!(r.html.contains(r#"src="https://x/y.png""#));
    }

    #[test]
    fn never_grants_non_images_absolute_paths_or_network_shares() {
        let r = Renderer::new()
            .with(LocalImages::new(|p| format!("asset:{}", p.display())))
            .render(
                "![](../../.ssh/id_rsa) ![](/etc/a.png) ![](//evil/share/a.png) ![](C:/a.png)",
                Path::new("/doc"),
            );
        assert!(r.assets.is_empty());
        assert!(!r.html.contains("asset:"));
    }
}
