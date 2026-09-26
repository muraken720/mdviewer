import type { Doc, Mode } from './types';

/** A page in a tab's back/forward history. */
export interface HistoryEntry {
  path: string;
  scroll: number;
}

let nextTabId = 0;

/** State of one tab. Mutated only by `App`; components read it. */
export class Tab {
  readonly id = ++nextTabId;
  doc: Doc | null = null;
  mode: Mode = 'view';
  /** Scroll position of the viewer (kept while the tab is hidden, restored from history). */
  scroll = 0;
  back: HistoryEntry[] = [];
  forward: HistoryEntry[] = [];
  /** Text as it is on disk. */
  savedText = '';
  /** Text that `doc.html` was rendered from. */
  renderedText = '';

  /** True if the text differs from the file on disk. */
  get dirty(): boolean {
    return !!this.doc && this.doc.raw !== this.savedText;
  }

  get empty(): boolean {
    return !this.doc;
  }

  /** The current page as a history entry. */
  entry(): HistoryEntry | null {
    return this.doc ? { path: this.doc.path, scroll: this.scroll } : null;
  }
}
