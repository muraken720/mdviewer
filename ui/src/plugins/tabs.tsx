// Tabs and per-tab history: the tab bar, back/forward, and tab switching.
import { TabBar } from '../components/TabBar';
import type { Plugin } from '../core/types';

const tabs: Plugin = {
  name: 'tabs',
  setup(app) {
    app.addBar(TabBar);

    app.command({
      id: 'nav.back',
      title: 'cmd.nav.back',
      keys: ['Alt+ArrowLeft'],
      run: () => app.back(),
      enabled: () => app.canGoBack(),
    });
    app.command({
      id: 'nav.forward',
      title: 'cmd.nav.forward',
      keys: ['Alt+ArrowRight'],
      run: () => app.forward(),
      enabled: () => app.canGoForward(),
    });
    app.command({ id: 'tab.next', title: 'cmd.tab.next', keys: ['Ctrl+Tab'], run: () => app.cycleTab(1) });
    app.command({ id: 'tab.prev', title: 'cmd.tab.prev', keys: ['Ctrl+Shift+Tab'], run: () => app.cycleTab(-1) });
    app.command({ id: 'tab.close', title: 'cmd.tab.close', keys: ['Ctrl+W'], run: () => app.closeTab() });

    app.addMenuItem({ menu: 'go', command: 'nav.back', group: 10, order: 1 });
    app.addMenuItem({ menu: 'go', command: 'nav.forward', group: 10, order: 2 });
    app.addMenuItem({ menu: 'go', command: 'tab.next', group: 20, order: 1 });
    app.addMenuItem({ menu: 'go', command: 'tab.prev', group: 20, order: 2 });
    app.addMenuItem({ menu: 'file', command: 'tab.close', group: 80 });

    // Mouse back/forward buttons (also keeps WebView2 from trying to navigate the window).
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      void app.run(e.button === 3 ? 'nav.back' : 'nav.forward');
    });
  },
};
export default tabs;
