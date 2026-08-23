import { toOneLiner } from "./src/convert.ts";
import { getStats } from "./src/stats.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

// --- One-liner conversion ---
check("basic join", toOneLiner("This is line one.\nThis is line two.\nThis is line three."), "This is line one. This is line two. This is line three.");
check("no concatenation", toOneLiner("Hello\nworld"), "Hello world");
check("CRLF", toOneLiner("Hello\r\nworld"), "Hello world");
check("CR only", toOneLiner("Hello\rworld"), "Hello world");
check("blank lines collapse", toOneLiner("Hello\n\n\n\nWorld"), "Hello World");
check("mixed whitespace around newlines", toOneLiner("Hello \n \n  world"), "Hello world");
check("leading/trailing trimmed", toOneLiner("\n\n Hello world \n\n"), "Hello world");
check("tabs around breaks", toOneLiner("a\t\n\tb"), "a b");
check("empty input", toOneLiner(""), "");
check("only newlines", toOneLiner("\n\n\r\n\r"), "");
check("internal double spaces normalized", toOneLiner("a\nb  c\nd"), "a b c d");
check("preserves case/punctuation", toOneLiner("The QUICK brown fox!\nJumps over."), "The QUICK brown fox! Jumps over.");

// --- Stats ---
check("empty stats", getStats(""), { lines: 0, words: 0, chars: 0 });
check("single word", getStats("hello"), { lines: 1, words: 1, chars: 5 });
check("two lines", getStats("one\ntwo"), { lines: 2, words: 2, chars: 7 });
check("multiple spaces no fake words", getStats("a   b\t\tc"), { lines: 1, words: 3, chars: 8 });
check("trailing newline counts as line", getStats("x\n"), { lines: 2, words: 1, chars: 2 });
check("chars include spaces", getStats("a b c"), { lines: 1, words: 3, chars: 5 });

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll tests passed");
