import { type ReactNode, useEffect, useId, useRef } from 'react';

/** A modal dialog. Esc or a click on the backdrop closes it. */
export function Dialog({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-[min(36rem,100%)] flex-col rounded-lg border border-line bg-bg text-fg shadow-xl"
      >
        <h2 id={titleId} className="border-line border-b px-5 py-3 font-bold">
          {title}
        </h2>
        <div className="overflow-auto px-5 py-4">{children}</div>
        <div className="flex justify-end border-line border-t px-5 py-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-4 py-1.5 text-sm hover:bg-code focus-visible:outline-2 focus-visible:outline-link"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
