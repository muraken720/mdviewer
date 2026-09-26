// In-document search. `findAll` is pure; `textRanges` maps matches onto DOM text nodes so that a
// match may span several nodes (e.g. "foo **bar**").

export interface Match {
  start: number;
  end: number;
}

/** All non-overlapping matches of `query` in `text`. */
export function findAll(text: string, query: string, matchCase = false): Match[] {
  if (!query) return [];
  const hay = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const out: Match[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
    out.push({ start: i, end: i + needle.length });
  }
  return out;
}

/** The text of `root` (text nodes concatenated) and where each node starts. */
export function collectText(root: Node): { text: string; nodes: Text[]; starts: number[] } {
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = '';
  for (let n = walker?.nextNode(); n; n = walker?.nextNode()) {
    nodes.push(n as Text);
    starts.push(text.length);
    text += n.nodeValue ?? '';
  }
  return { text, nodes, starts };
}

/** DOM Ranges for the matches of `query` in `root`. */
export function textRanges(root: Node, query: string, matchCase = false): Range[] {
  const { text, nodes, starts } = collectText(root);
  const doc = root.ownerDocument;
  if (!doc) return [];
  const locate = (offset: number, isEnd: boolean): [Text, number] | null => {
    // Last node starting at or before the offset (for an end, strictly before).
    let i = nodes.length - 1;
    while (i > 0 && ((starts[i] ?? 0) > offset || (isEnd && starts[i] === offset))) i--;
    const node = nodes[i];
    return node ? [node, offset - (starts[i] ?? 0)] : null;
  };
  return findAll(text, query, matchCase).flatMap(({ start, end }) => {
    const a = locate(start, false);
    const b = locate(end, true);
    if (!a || !b) return [];
    const range = doc.createRange();
    range.setStart(...a);
    range.setEnd(...b);
    return [range];
  });
}
