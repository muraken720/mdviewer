import type { App } from '../core/app';
import type { Command } from '../core/types';
import { ShortcutList } from './ShortcutList';

const HIGHLIGHTS = ['file.open', 'view.toggleEdit', 'find.open', 'nav.back', 'help.shortcuts'];

/** Shown in an empty tab: how to open a file and the main shortcuts. */
export function StartScreen({ app }: { app: App }) {
  const commands = HIGHLIGHTS.map((id) => app.getCommand(id)).filter((c): c is Command => !!c);
  return (
    <div className="flex flex-col items-center px-4 pt-[15vh] text-center text-muted">
      <p>{app.t('start.open')}</p>
      <div className="mt-6">
        <ShortcutList app={app} commands={commands} />
      </div>
    </div>
  );
}
