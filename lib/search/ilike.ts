/**
 * Turn free text into a literal "contains" pattern for Postgres ILIKE.
 * `%` and `_` are LIKE wildcards and `\` is the default escape character, so
 * all three are escaped; without this, searching "100%" matched everything.
 */
export function toIlikePattern(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
  return `%${escaped}%`
}
