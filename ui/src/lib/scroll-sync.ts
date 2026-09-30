// Keeping roughly the same place when switching between the formatted view and the editor.
// Headings anchor the two: the n-th heading in the view is the n-th heading line in the Markdown,
// and positions in between are interpolated. Pure functions; the DOM side is in plugins/editor.tsx.

/** 0-based line numbers of ATX headings (`# …`, also inside quotes), skipping fenced code blocks. */
export function headingLines(text: string): number[] {
  const out: number[] = [];
  let fence: string | null = null;
  text.split('\n').forEach((line, i) => {
    // A backtick fence's info string cannot contain backticks (so "```` ``` ```` text" is inline code).
    const marker = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (marker) fence = marker;
    else if (/^ {0,3}(?:> ?)*#{1,6}(?:[ \t]|$)/.test(line)) out.push(i);
  });
  return out;
}

/** Piecewise-linear map of `x` through the points (xs[i], ys[i]); xs ascending. Clamped at the ends. */
export function interpolate(x: number, xs: number[], ys: number[]): number {
  const last = xs.length - 1;
  if (last < 0) return 0;
  if (x <= (xs[0] as number)) return ys[0] as number;
  if (x >= (xs[last] as number)) return ys[last] as number;
  let i = 0;
  while (i < last - 1 && (xs[i + 1] as number) <= x) i++;
  const x0 = xs[i] as number;
  const x1 = xs[i + 1] as number;
  const y0 = ys[i] as number;
  const y1 = ys[i + 1] as number;
  return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}
