/**
 * Parse YAML-ish frontmatter from a Markdown string.
 * Returns { meta, body } where meta is a key-value record and body is the
 * remaining Markdown after the closing `---`.
 */
export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return { meta: {}, body: content };
  const end = trimmed.indexOf('---', 3);
  if (end === -1) return { meta: {}, body: content };

  const raw = trimmed.slice(3, end).trim();
  const meta: Record<string, string> = {};
  let currentKey = '';
  for (const line of raw.split('\n')) {
    // Support keys with hyphens (e.g. "multi-word-key: value")
    const match = line.match(/^([\w][\w\s-]*?):\s*(.*)$/);
    if (match) {
      currentKey = match[1].trim();
      const rawValue = match[2].trim();
      // Strip YAML block scalar indicators (|, >, |2, >-, |2+ etc.)
      if (/^[|>][\d]*[+-]?$/.test(rawValue)) {
        meta[currentKey] = '';
      } else {
        meta[currentKey] = rawValue;
      }
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      // Continuation line: append with space separator
      const trimmedLine = line.trim();
      if (trimmedLine) {
        meta[currentKey] = meta[currentKey]
          ? meta[currentKey] + ' ' + trimmedLine
          : trimmedLine;
      }
    }
  }

  return { meta, body: trimmed.slice(end + 3).trimStart() };
}
