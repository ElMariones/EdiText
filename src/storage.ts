export interface Draft {
  name: string | null;
  text: string;
}

const KEY = "editext.draft.v1";

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Safari private mode or blocked storage — persistence silently off.
    return null;
  }
}

export function loadDraft(): Draft | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (typeof parsed.text !== "string") return null;
    return { name: typeof parsed.name === "string" ? parsed.name : null, text: parsed.text };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Quota errors etc. — autosave is best-effort by design.
  }
}

export function clearStoredDraft(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* noop */
  }
}
