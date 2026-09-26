// Help menu: keyboard shortcuts (F1) and About.
import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { commandsInMenuOrder, ShortcutList } from '../components/ShortcutList';
import type { App } from '../core/app';
import type { AppInfo, Plugin } from '../core/types';

type Which = 'shortcuts' | 'about' | null;

function HelpDialogs({ app }: { app: App }) {
  const [which, setWhich] = useState<Which>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => app.on('plugin:help', (w) => setWhich(w as Which)), [app]);
  useEffect(() => {
    if (which === 'about' && !info) void app.backend.appInfo().then(setInfo);
  }, [app, which, info]);

  if (!which) return null;
  const close = () => setWhich(null);

  if (which === 'shortcuts') {
    return (
      <Dialog title={app.t('help.title')} closeLabel={app.t('dialog.close')} onClose={close}>
        <ShortcutList app={app} commands={commandsInMenuOrder(app)} />
        <h3 className="mt-4 mb-1 font-bold text-sm">{app.t('help.mouse')}</h3>
        <ul className="list-disc pl-5 text-sm">
          <li>{app.t('help.wheel')}</li>
          <li>{app.t('help.backButton')}</li>
          <li>{app.t('help.drop')}</li>
        </ul>
      </Dialog>
    );
  }

  const link = (url: string, label: string) => (
    <button type="button" onClick={() => void app.backend.openUrl(url)} className="text-link hover:underline">
      {label}
    </button>
  );
  return (
    <Dialog title={app.t('about.title')} closeLabel={app.t('dialog.close')} onClose={close}>
      <p className="font-bold text-lg">mdviewer</p>
      <p className="mb-4 text-muted text-sm">{app.t('about.tagline')}</p>
      {info && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{app.t('about.version')}</dt>
          <dd>{info.version}</dd>
          <dt className="text-muted">{app.t('about.author')}</dt>
          <dd>{info.authors}</dd>
          <dt className="text-muted">{app.t('about.license')}</dt>
          <dd>{info.license}</dd>
          <dt className="text-muted">{app.t('about.repository')}</dt>
          <dd className="break-all">{link(info.repository, info.repository.replace(/^https:\/\//, ''))}</dd>
          <dt className="text-muted">{app.t('about.thirdParty')}</dt>
          <dd>{link(`${info.repository}/blob/main/THIRD_PARTY_LICENSES.md`, 'THIRD_PARTY_LICENSES.md')}</dd>
        </dl>
      )}
      <p className="mt-4 text-muted text-sm">{app.t('about.thanks')}</p>
    </Dialog>
  );
}

const help: Plugin = {
  name: 'help',
  setup(app) {
    app.addOverlay(HelpDialogs);
    app.command({
      id: 'help.shortcuts',
      title: 'cmd.help.shortcuts',
      keys: ['F1'],
      run: () => app.emit('plugin:help', 'shortcuts'),
    });
    app.command({ id: 'help.about', title: 'cmd.help.about', run: () => app.emit('plugin:help', 'about') });
    app.addMenuItem({ menu: 'help', command: 'help.shortcuts', group: 10 });
    app.addMenuItem({ menu: 'help', command: 'help.about', group: 20 });
  },
};
export default help;
