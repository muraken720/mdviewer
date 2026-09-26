import type { App } from '../core/app';
import { useAppVersion } from '../core/useApp';

/** Lays out the panes and overlays contributed by plugins. */
export function Shell({ app }: { app: App }) {
  useAppVersion(app);
  return (
    <>
      {app.panes().map(([mode, Pane]) => (
        <Pane key={mode} app={app} active={app.mode === mode} />
      ))}
      {app.overlays().map((Overlay, i) => (
        <Overlay key={i} app={app} />
      ))}
    </>
  );
}
