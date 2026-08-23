export interface Doc {
  id: string;
  name: string | null;
  text: string;
  updatedAt: number;
}

export interface DocStore {
  activeId: string;
  docs: Doc[];
}

const DOCS_KEY = "editext.docs.v1";
const DRAFT_KEY = "editext.draft.v1";

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Safari private mode or blocked storage — persistence silently off.
    return null;
  }
}

export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function saveDocs(st: DocStore): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(DOCS_KEY, JSON.stringify(st));
  } catch {
    // Quota errors etc. — persistence is best-effort by design.
  }
}

/** Load the persisted document set, migrating the legacy single-draft format. */
export function loadDocs(): DocStore | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DocStore>;
      const docs = Array.isArray(parsed.docs)
        ? parsed.docs.filter(
            (d): d is Doc => !!d && typeof d.id === "string" && typeof d.text === "string"
          )
        : [];
      if (docs.length > 0) {
        const activeId = docs.some((d) => d.id === parsed.activeId)
          ? (parsed.activeId as string)
          : docs[0]!.id;
        return { activeId, docs };
      }
    }

    // Legacy single-draft format from earlier versions.
    const draft = s.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as Partial<{ name: string; text: string }>;
        if (typeof parsed.text === "string") {
          s.removeItem(DRAFT_KEY);
          const doc: Doc = {
            id: uid(),
            name: typeof parsed.name === "string" ? parsed.name : null,
            text: parsed.text,
            updatedAt: Date.now(),
          };
          const st: DocStore = { activeId: doc.id, docs: [doc] };
          saveDocs(st);
          return st;
        }
      } catch {
        /* fall through */
      }
    }
    s.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
  return null;
}
