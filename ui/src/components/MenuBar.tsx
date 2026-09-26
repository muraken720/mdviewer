import { Fragment, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { App, Menu } from '../core/app';
import type { Command } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { formatKey } from './format-key';

/** "ファイル(F)" in Japanese; "File" with the access key underlined in English. */
function MenuLabel({ text, mnemonic, lang }: { text: string; mnemonic: string; lang: string }) {
  if (lang === 'ja') return <>{`${text}(${mnemonic.toUpperCase()})`}</>;
  const i = text.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="underline">{text[i]}</span>
      {text.slice(i + 1)}
    </>
  );
}

const enabled = (c: Command) => !c.enabled || c.enabled();

const ITEM_CLASS =
  'grid w-full grid-cols-[1.25rem_1fr_auto] items-center gap-2 px-2 py-1 text-left hover:bg-code focus:bg-code focus:outline-none disabled:opacity-40';

/** One entry of a drop-down menu: a plain item, or a check item when the command has `checked`. */
function MenuItem({
  app,
  command: c,
  onRun,
  register,
}: {
  app: App;
  command: Command;
  onRun: (c: Command) => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const content = (checked: boolean) => (
    <>
      <span aria-hidden="true">{checked ? '✓' : ''}</span>
      <span className="truncate">{app.t(c.title ?? c.id)}</span>
      <span className="pl-6 text-muted text-xs">{c.keys?.[0] ? formatKey(c.keys[0]) : ''}</span>
    </>
  );
  const common = { ref: register, disabled: !enabled(c), onClick: () => onRun(c), className: ITEM_CLASS } as const;
  const checked = c.checked?.();
  return checked === undefined ? (
    <button type="button" role="menuitem" {...common}>
      {content(false)}
    </button>
  ) : (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} {...common}>
      {content(checked)}
    </button>
  );
}

/**
 * The application menu bar (WAI-ARIA menubar pattern).
 * Mouse: click to open, hover to switch. Keyboard: Alt or F10 focuses the bar, Alt+letter opens a
 * menu, arrows move, Enter/Space runs, Esc closes and returns focus to where it was.
 */
export function MenuBar({ app }: { app: App }) {
  useAppVersion(app);
  const menus = app.menus();
  const [open, setOpen] = useState<number | null>(null);
  const [focusItem, setFocusItem] = useState<'first' | 'last' | null>(null);
  const bar = useRef<(HTMLButtonElement | null)[]>([]);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  /** Remember where focus was, to return there when the menu closes. */
  const remember = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!root.current?.contains(el)) returnTo.current = el;
  }, []);
  const restoreFocus = useCallback(() => {
    returnTo.current?.focus?.();
    returnTo.current = null;
  }, []);

  const openMenu = useCallback(
    (i: number, focus: 'first' | 'last' | null = 'first') => {
      remember();
      setOpen(i);
      setFocusItem(focus);
    },
    [remember],
  );

  const close = useCallback(
    (refocus: 'bar' | 'previous' | 'none' = 'previous') => {
      const current = open;
      setOpen(null);
      if (refocus === 'bar' && current !== null) bar.current[current]?.focus();
      else if (refocus === 'previous') restoreFocus();
    },
    [open, restoreFocus],
  );

  // Focus the first/last enabled item after a menu opens.
  useEffect(() => {
    if (open === null || !focusItem) return;
    const list = items.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    (focusItem === 'first' ? list[0] : list.at(-1))?.focus();
    setFocusItem(null);
  }, [open, focusItem]);

  // Requests from commands: Alt+letter opens a menu, F10 focuses the bar.
  useEffect(() => {
    const offOpen = app.on('plugin:menu-open', (id) => {
      const i = app.menus().findIndex((m) => m.def.id === id);
      if (i >= 0) openMenu(i);
    });
    const offFocus = app.on('plugin:menu-focus', () => {
      remember();
      bar.current[0]?.focus();
    });
    return () => {
      offOpen();
      offFocus();
    };
  }, [app, openMenu, remember]);

  // Pressing and releasing Alt alone focuses the bar (like native Windows menus).
  useEffect(() => {
    let altAlone = false;
    const down = (e: globalThis.KeyboardEvent) => {
      altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey;
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Alt' || !altAlone) return;
      altAlone = false;
      e.preventDefault();
      if (root.current?.contains(document.activeElement)) {
        setOpen(null);
        restoreFocus();
      } else {
        remember();
        bar.current[0]?.focus();
      }
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [restoreFocus, remember]);

  // A click anywhere else closes the open menu.
  useEffect(() => {
    if (open === null) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', onPointer, true);
    return () => window.removeEventListener('pointerdown', onPointer, true);
  }, [open]);

  const run = (c: Command) => {
    close('previous');
    void app.run(c.id);
  };

  const onBarKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = menus.length;
    const move = (to: number) => {
      bar.current[(to + n) % n]?.focus();
      if (open !== null) openMenu((to + n) % n);
    };
    switch (e.key) {
      case 'ArrowRight':
        move(i + 1);
        break;
      case 'ArrowLeft':
        move(i - 1);
        break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        openMenu(i, 'first');
        break;
      case 'ArrowUp':
        openMenu(i, 'last');
        break;
      case 'Escape':
        close('previous');
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const list = items.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const n = menus.length;
    switch (e.key) {
      case 'ArrowDown':
        list[(at + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        list[(at - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        list[0]?.focus();
        break;
      case 'End':
        list.at(-1)?.focus();
        break;
      case 'ArrowRight':
        openMenu((i + 1) % n);
        break;
      case 'ArrowLeft':
        openMenu((i - 1 + n) % n);
        break;
      case 'Escape':
        close('bar');
        break;
      case 'Tab':
        close('previous');
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  items.current = [];
  return (
    <div
      ref={root}
      role="menubar"
      aria-label="Menu"
      className="flex h-8 select-none items-stretch overflow-x-auto border-line border-b bg-code px-1 text-sm"
    >
      {menus.map((menu: Menu, i) => (
        <div key={menu.def.id} className="relative">
          <button
            ref={(el) => {
              bar.current[i] = el;
            }}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => (open === i ? close('previous') : openMenu(i, null))}
            onMouseEnter={() => open !== null && open !== i && openMenu(i, null)}
            onKeyDown={(e) => onBarKey(e, i)}
            className={`h-full whitespace-nowrap rounded px-2.5 hover:bg-line/60 focus-visible:outline-2 focus-visible:outline-link ${open === i ? 'bg-line/60' : ''}`}
          >
            <MenuLabel text={app.t(menu.def.label)} mnemonic={menu.def.mnemonic} lang={app.i18n.lang} />
          </button>
          {open === i && (
            <div
              role="menu"
              aria-label={app.t(menu.def.label)}
              onKeyDown={(e) => onMenuKey(e, i)}
              className="fixed z-50 mt-0 min-w-56 max-w-[calc(100vw-1rem)] rounded-md border border-line bg-bg py-1 shadow-lg"
              style={{
                left: Math.min(bar.current[i]?.getBoundingClientRect().left ?? 0, window.innerWidth - 240),
                top: 32,
              }}
            >
              {menu.groups.map((group, g) => (
                <Fragment key={group[0]?.id ?? g}>
                  {g > 0 && <hr className="my-1 border-line" />}
                  {group.map((c) => (
                    <MenuItem
                      key={c.id}
                      app={app}
                      command={c}
                      onRun={run}
                      register={(el) => {
                        items.current.push(el);
                      }}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
