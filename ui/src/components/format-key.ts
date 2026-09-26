// Display form of key bindings ("Alt+ArrowLeft" → "Alt+←").
const NAMES: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc',
  ' ': 'Space',
};

export function keyParts(spec: string): string[] {
  return spec.split(/\+(?=.)/).map((p) => NAMES[p.toLowerCase()] ?? (p.length === 1 ? p.toUpperCase() : p));
}

export function formatKey(spec: string): string {
  return keyParts(spec).join('+');
}
