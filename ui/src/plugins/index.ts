// Built-in UI plugins, in load order. Add or remove UI features here.
// Any plugin can be turned off in settings.json; see docs/PLUGINS.md.
import type { Plugin } from '../core/types';
import view from './view';
import editor from './editor';
import title from './title';
import openFile from './open-file';
import links from './links';
import zoom from './zoom';
import autoReload from './auto-reload';
import math from './math';
import mermaid from './mermaid';

const plugins: Plugin[] = [view, editor, title, openFile, links, zoom, autoReload, math, mermaid];
export default plugins;
