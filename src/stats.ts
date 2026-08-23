export interface Stats {
  lines: number;
  words: number;
  chars: number;
}

/**
 * Live document statistics.
 * - Lines: newline-separated segments; an empty document has 0 lines.
 * - Words: whitespace-delimited runs, so extra spaces never create fake words.
 * - Characters: exact length, spaces and punctuation included.
 */
export function getStats(text: string): Stats {
  return {
    lines: text === "" ? 0 : text.split("\n").length,
    words: countWords(text),
    chars: text.length,
  };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length; // split collapses all whitespace runs
}
