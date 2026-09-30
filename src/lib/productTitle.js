export function splitProductTitle(title) {
  const text = String(title || '').trim();
  for (const match of text.matchAll(/\s+[|—–]\s+|,\s+/g)) {
    if (match.index < 24) continue;
    return { name: text.slice(0, match.index), details: text.slice(match.index + match[0].length) };
  }
  return { name: text, details: '' };
}
