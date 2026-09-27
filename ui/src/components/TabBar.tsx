import { useEffect, useRef } from 'react';
import type { App } from '../core/app';
import { useAppVersion } from '../core/useApp';
import { formatKey } from './format-key';

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-7 w-7 shrink-0 rounded text-lg leading-none hover:bg-line/60 focus-visible:outline-2 focus-visible:outline-link disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Back/forward buttons and one tab per document. Scrolls horizontally when the window is narrow. */
export function TabBar({ app }: { app: App }) {
  useAppVersion(app);
  const activeRef = useRef<HTMLDivElement>(null);
  const active = app.active;

  // Keep the active tab visible when it changes and when the window is resized.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when another tab becomes active
  useEffect(() => {
    const reveal = () => activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
  }, [active]);

  const hint = (id: string) => {
    const c = app.getCommand(id);
    return c ? `${app.t(c.title ?? '')} (${formatKey(c.keys?.[0] ?? '')})` : '';
  };

  return (
    <div className="flex h-9 items-end gap-1 border-line border-b bg-code px-1">
      <div className="flex h-full items-center">
        <NavButton label={hint('nav.back')} disabled={!app.canGoBack()} onClick={() => void app.back()}>
          ‹
        </NavButton>
        <NavButton label={hint('nav.forward')} disabled={!app.canGoForward()} onClick={() => void app.forward()}>
          ›
        </NavButton>
      </div>
      <div
        role="tablist"
        aria-label="Documents"
        // The scrollbar is hidden (it would cover the tab names); the wheel scrolls sideways instead.
        onWheel={(e) => {
          if (!e.ctrlKey && e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
        }}
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]"
      >
        {app.tabs.map((tab) => {
          const selected = tab === active;
          const name = tab.doc?.name ?? app.t('tab.empty');
          return (
            <div
              key={tab.id}
              ref={selected ? activeRef : undefined}
              className={`group flex h-8 min-w-24 max-w-52 shrink-0 items-center rounded-t-md border border-b-0 text-sm ${
                selected ? 'border-line bg-bg' : 'border-transparent text-muted hover:bg-line/40'
              }`}
            >
              <button
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`tabpanel-${tab.id}`}
                title={tab.doc?.path ?? name}
                onClick={() => app.activate(tab.id)}
                onAuxClick={(e) => e.button === 1 && void app.closeTab(tab.id)}
                className="min-w-0 flex-1 truncate py-1 pr-1 pl-3 text-left focus-visible:outline-2 focus-visible:outline-link"
              >
                {tab.dirty && <span aria-hidden="true">● </span>}
                {tab.mode === 'edit' && (
                  // Marks the tabs being edited (the View | Edit switch shows only the active one).
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="mr-1 inline h-3.5 w-3.5 fill-none stroke-2 stroke-current align-[-2px] [stroke-linecap:round] [stroke-linejoin:round]"
                  >
                    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                )}
                {name}
                {tab.mode === 'edit' && <span className="sr-only"> ({app.t('mode.edit')})</span>}
              </button>
              <button
                type="button"
                aria-label={`${app.t('tab.close')}: ${name}`}
                title={app.t('tab.close')}
                onClick={() => void app.closeTab(tab.id)}
                className={`mr-1 h-5 w-5 shrink-0 rounded leading-none hover:bg-line focus-visible:opacity-100 ${selected ? '' : 'opacity-0 group-hover:opacity-100'}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
