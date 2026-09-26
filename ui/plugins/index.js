// Built-in UI plugins, in load order. Add or remove UI features here.
import view from './view.js';
import openFile from './open-file.js';
import links from './links.js';
import zoom from './zoom.js';
import autoReload from './auto-reload.js';

export default [view, openFile, links, zoom, autoReload];
