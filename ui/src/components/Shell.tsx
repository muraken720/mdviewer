import type { App } from '../core/app';
import { useAppVersion } from '../core/useApp';

/**
 * Window layout: bars (menu, tabs) on top, then one panel per tab holding that tab's panes.
 * Panels stay mounted while hidden, so each tab keeps its editor undo history and rendered
 * diagrams; only the active tab's pane for its mode is shown. Overlays are positioned over the
 * content area.
 */
export function Shell({ app }: { app: App }) {
  useAppVersion(app);
  const active = app.active;
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 print:hidden">
        {app.bars().map((Bar, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are registered once at startup and never reordered
          <Bar key={i} app={app} />
        ))}
      </header>
      <div className="relative min-h-0 flex-1">
        {app.tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`tabpanel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={tab !== active}
            className="absolute inset-0"
          >
            {app.panes().map(([mode, Pane]) => (
              <Pane key={mode} app={app} tab={tab} active={tab === active && tab.mode === mode} />
            ))}
          </div>
        ))}
        {app.overlays().map((Overlay, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: overlays are registered once at startup and never reordered
          <Overlay key={i} app={app} />
        ))}
      </div>
    </div>
  );
}
