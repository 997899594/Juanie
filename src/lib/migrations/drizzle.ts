export interface DrizzleJournalEntry {
  idx: number;
  tag: string;
  when: number;
}

export function parseDrizzleJournalEntries(
  content: string | null | undefined
): DrizzleJournalEntry[] {
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content) as
    | {
        entries?: Array<{
          idx?: unknown;
          tag?: unknown;
          when?: unknown;
        }>;
      }
    | Array<{ idx?: unknown; tag?: unknown; when?: unknown }>;

  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.entries)
      ? parsed.entries
      : [];

  return entries
    .map((entry, index) => ({
      idx: typeof entry?.idx === 'number' && Number.isFinite(entry.idx) ? entry.idx : index,
      tag: typeof entry?.tag === 'string' ? entry.tag.trim() : '',
      when:
        typeof entry?.when === 'number' && Number.isFinite(entry.when) ? entry.when : Date.now(),
    }))
    .filter((entry) => entry.tag.length > 0)
    .sort((left, right) => left.idx - right.idx);
}

export function drizzleTagToFilename(tag: string): string {
  return tag.endsWith('.sql') ? tag : `${tag}.sql`;
}
