import type { App } from '../core/app';

/** Shown when no document is open: how to open one, and the shortcut list built from commands. */
export function StartScreen({ app }: { app: App }) {
  const commands = app.commands().flatMap((c) => (c.title && c.keys?.[0] ? [{ ...c, key: c.keys[0] }] : []));
  return (
    <div className="pt-[18vh] text-center text-muted">
      <p>Markdown ファイルをドロップ、またはダブルクリックで開きます</p>
      <table className="mx-auto mt-6 text-left text-sm">
        <tbody>
          {commands.map((c) => (
            <tr key={c.id}>
              <td className="py-1 pr-6 whitespace-nowrap">
                <Keys spec={c.key} />
              </td>
              <td className="py-1">{c.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Keys({ spec }: { spec: string }) {
  const parts = spec.split(/\+(?=.)/);
  return (
    <>
      {parts.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list; the same key can repeat
        <span key={i}>
          {i > 0 && '+'}
          <kbd className="rounded border border-b-2 border-line px-1.5 py-0.5 font-mono text-xs">{p}</kbd>
        </span>
      ))}
    </>
  );
}
