// Built-in UI plugins, in load order. Add or remove UI features here.
// Any plugin can be turned off in settings.json; see docs/PLUGINS.md.
import type { Plugin } from '../core/types';
import autoReload from './auto-reload';
import editor from './editor';
import links from './links';
import math from './math';
import mermaid from './mermaid';
import openFile from './open-file';
import title from './title';
import view from './view';
import zoom from './zoom';

const plugins: Plugin[] = [view, editor, title, openFile, links, zoom, autoReload, math, mermaid];
export default plugins;
