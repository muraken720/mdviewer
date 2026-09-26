import type { App } from '../core/app';
import type { Command } from '../core/types';
import { Keys } from './Keys';

/** Table of commands with their first key binding. */
export function ShortcutList({ app, commands }: { app: App; commands: Command[] }) {
  const rows = commands.filter((c) => c.title && c.keys?.[0]);
  return (
    <table className="text-left text-sm">
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="py-1 pr-6 align-top">
              <Keys spec={c.keys?.[0] ?? ''} />
            </td>
            <td className="py-1">{app.t(c.title ?? '')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Commands in menu order (for the help dialog). */
export function commandsInMenuOrder(app: App): Command[] {
  const seen = new Set<string>();
  const list: Command[] = [];
  for (const menu of app.menus()) {
    for (const group of menu.groups) {
      for (const c of group) {
        if (!seen.has(c.id)) list.push(c);
        seen.add(c.id);
      }
    }
  }
  return list;
}
