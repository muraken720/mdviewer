import type { App } from '../core/app';
import { useAppVersion } from '../core/useApp';

/**
 * Window layout: bars (menu, tabs) on top, then one panel per tab holding that tab's panes, then
 * the status bar (zoom level, View | Edit switch) at the bottom.
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
      {app.statusItems().length > 0 && (
        <footer className="flex h-8 shrink-0 items-center justify-end gap-3 border-line border-t bg-code px-2 text-muted text-xs print:hidden">
          {app.statusItems().map((Item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: status items are registered once at startup and never reordered
            <Item key={i} app={app} />
          ))}
        </footer>
      )}
    </div>
  );
}
