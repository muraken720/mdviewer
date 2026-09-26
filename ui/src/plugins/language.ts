// Menu language: automatic (OS setting), Japanese or English. The choice is remembered.

import type { Plugin } from '../core/types';
import type { LangSetting } from '../i18n';

const OPTIONS: LangSetting[] = ['auto', 'ja', 'en'];

const language: Plugin = {
  name: 'language',
  setup(app) {
    OPTIONS.forEach((setting, i) => {
      app.command({
        id: `lang.${setting}`,
        title: `cmd.lang.${setting}`,
        run: () => app.setLanguage(setting),
        checked: () => app.i18n.setting === setting,
      });
      app.addMenuItem({ menu: 'view', command: `lang.${setting}`, group: 90, order: i });
    });
    const syncHtmlLang = () => document.documentElement.setAttribute('lang', app.i18n.lang);
    syncHtmlLang();
    app.on('lang:changed', syncHtmlLang);
  },
};
export default language;
