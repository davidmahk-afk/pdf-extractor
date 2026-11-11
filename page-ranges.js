/** Parse 1-based PDF page ranges into zero-based indices. Preserves order and duplicates. */
export function parsePageSelection(input, totalPages) {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) throw new Error('The PDF has no pages.');
  const cleaned = String(input ?? '').trim();
  if (!cleaned) throw new Error('Enter at least one page number or range.');
  const output = [];
  for (const rawToken of cleaned.split(',')) {
    const token = rawToken.trim();
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error(`Invalid entry: "${token || '(empty)'}". Use numbers and ranges like 1-3, 5.`);
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1 || start > totalPages || end > totalPages)
      throw new Error(`Page numbers must be between 1 and ${totalPages}.`);
    if (end < start) throw new Error(`Range ${token} goes backwards. List pages individually to reverse their order.`);
    for (let page = start; page <= end; page++) output.push(page - 1);
  }
  return output;
}
export function presetPages(preset, pageCount) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) return '';
  if (preset === 'all') return `1-${pageCount}`;
  if (preset === 'last') return String(pageCount);
  if (preset === 'odd' || preset === 'even') {
    const start = preset === 'odd' ? 1 : 2;
    return Array.from({ length: Math.max(0, Math.ceil((pageCount - start + 1) / 2)) }, (_, i) => start + 2 * i).join(', ');
  }
  throw new Error('Unknown page preset.');
}
