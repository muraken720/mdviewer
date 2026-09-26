import { keyParts } from './format-key';

/** A key binding drawn as keycaps: Ctrl + O. */
export function Keys({ spec }: { spec: string }) {
  return (
    <span className="whitespace-nowrap">
      {keyParts(spec).map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list; the same key can repeat
        <span key={i}>
          {i > 0 && '+'}
          <kbd className="rounded border border-b-2 border-line px-1.5 py-0.5 font-mono text-xs">{p}</kbd>
        </span>
      ))}
    </span>
  );
}
