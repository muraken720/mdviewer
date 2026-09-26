// Built-in UI plugins, in load order. Add or remove UI features here.
// Any plugin can be turned off in settings.json; plugins with `enabledByDefault: false` must be
// turned on there (see docs/PLUGINS.md).
import view from './view.js';
import editor from './editor.js';
import title from './title.js';
import openFile from './open-file.js';
import links from './links.js';
import zoom from './zoom.js';
import autoReload from './auto-reload.js';
import mermaid from './mermaid.js';

export default [view, editor, title, openFile, links, zoom, autoReload, mermaid];
