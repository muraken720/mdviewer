// Window title: "● name.md - mdviewer" while there are unsaved changes.
import type { Doc, Plugin } from '../core/types';

export function windowTitle(doc: Pick<Doc, 'name'> | null, dirty: boolean): string {
  return doc ? `${dirty ? '● ' : ''}${doc.name} - mdviewer` : 'mdviewer';
}

const title: Plugin = {
  name: 'title',
  setup(app) {
    const update = () => void app.backend.setTitle(windowTitle(app.doc, app.dirty));
    app.on('doc:loaded', update);
    app.on('doc:dirty', update);
    app.on('tabs:changed', update);
  },
};
export default title;
