// Shows the rendered document, and toggles between the viewer and the editor.
export default {
  name: 'view',
  setup(app) {
    const $view = document.getElementById('view');
    const $toggle = document.getElementById('toggle');

    const apply = () => {
      const editing = app.mode === 'edit' && !!app.doc;
      $view.hidden = editing;
      $toggle.textContent = editing ? 'View' : 'Edit';
    };

    const show = (html, keepScroll) => {
      const y = window.scrollY;
      $view.innerHTML = html;
      window.scrollTo(0, keepScroll ? y : 0);
    };

    app.on('doc:loaded', (doc, { reset }) => {
      show(doc.html, !reset);
      $toggle.hidden = false;
      apply();
    });
    app.on('doc:rendered', (doc) => show(doc.html, true));

    app.on('doc:error', (err, { keepView } = {}) => {
      const p = document.createElement('p');
      p.className = 'error';
      p.textContent = String(err);
      if (keepView) {
        $view.prepend(p);
        setTimeout(() => p.remove(), 5000);
        return;
      }
      $view.replaceChildren(p);
      app.setMode('view');
    });

    app.on('mode:changed', apply);
    app.command('view.toggleEdit', () => app.setMode(app.mode === 'edit' ? 'view' : 'edit'), ['Ctrl+E']);
    $toggle.addEventListener('click', () => app.run('view.toggleEdit'));
  },
};
