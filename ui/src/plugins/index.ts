// Built-in UI plugins, in load order. Add or remove UI features here.
// Any plugin can be turned off in settings.json; see docs/PLUGINS.md.
import type { Plugin } from '../core/types';
import autoReload from './auto-reload';
import editor from './editor';
import find from './find';
import help from './help';
import language from './language';
import links from './links';
import math from './math';
import menu from './menu';
import mermaid from './mermaid';
import openFile from './open-file';
import tabs from './tabs';
import title from './title';
import view from './view';
import zoom from './zoom';

const plugins: Plugin[] = [
  menu,
  tabs,
  view,
  editor,
  title,
  openFile,
  links,
  zoom,
  find,
  language,
  help,
  autoReload,
  math,
  mermaid,
];
export default plugins;
