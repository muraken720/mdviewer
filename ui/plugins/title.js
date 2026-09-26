// Window title: "● name.md - mdviewer" while there are unsaved changes.
export function windowTitle(doc, dirty) {
  return doc ? `${dirty ? '● ' : ''}${doc.name} - mdviewer` : 'mdviewer';
}

export default {
  name: 'title',
  setup(app) {
    const update = () => app.backend.setTitle(windowTitle(app.doc, app.dirty));
    app.on('doc:loaded', update);
    app.on('doc:dirty', update);
  },
};
