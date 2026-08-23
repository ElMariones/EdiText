/**
 * Text → One-Liner conversion.
 *
 * Mechanical transformation only:
 * - normalize every newline style (\r\n, \r, \n)
 * - turn line separators into single spaces (never concatenate words)
 * - collapse blank-line runs and the spacing around them
 * - trim the edges; never change casing, wording or spelling
 */
export function toOneLiner(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]*\n+[^\S\n]*/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}
