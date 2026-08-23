import "./style.css";
import { icons, injectIcons } from "./icons";
import { toOneLiner } from "./convert";
import { getStats } from "./stats";
import { type Doc, loadDocs, saveDocs, uid } from "./storage";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */
/* Element refs                                                        */
/* ------------------------------------------------------------------ */

const editor = byId<HTMLTextAreaElement>("editor");
const fileNameEl = byId<HTMLSpanElement>("file-name");
const statLines = byId<HTMLSpanElement>("stat-lines");
const statWords = byId<HTMLSpanElement>("stat-words");
const statChars = byId<HTMLSpanElement>("stat-chars");
const saveStatusEl = byId<HTMLSpanElement>("save-status");
const saveTextEl = byId<HTMLSpanElement>("save-text");

const newBtn = byId<HTMLButtonElement>("new-btn");
const openBtn = byId<HTMLButtonElement>("open-btn");
const saveBtn = byId<HTMLButtonElement>("save-btn");
const copyBtn = byId<HTMLButtonElement>("copy-btn");
const clearBtn = byId<HTMLButtonElement>("clear-btn");
const oneLinerBtn = byId<HTMLButtonElement>("oneliner-btn");

const fileInput = byId<HTMLInputElement>("file-input");

const sidebar = byId<HTMLElement>("sidebar");
const sidebarToggle = byId<HTMLButtonElement>("sidebar-toggle");
const sidebarScrim = byId<HTMLDivElement>("sidebar-scrim");
const newDocBtn = byId<HTMLButtonElement>("new-doc-btn");
const docList = byId<HTMLUListElement>("doc-list");

const onelinerPanel = byId<HTMLElement>("oneliner-panel");
const olHideBtn = byId<HTMLButtonElement>("ol-hide-btn");
const olInput = byId<HTMLTextAreaElement>("ol-input");
const olOutput = byId<HTMLTextAreaElement>("ol-output");
const olCopy = byId<HTMLButtonElement>("ol-copy");

const confirmOverlay = byId<HTMLDivElement>("confirm-overlay");
const confirmTitle = byId<HTMLElement>("confirm-title");
const confirmMessage = byId<HTMLElement>("confirm-message");
const confirmCancel = byId<HTMLButtonElement>("confirm-cancel");
const confirmOk = byId<HTMLButtonElement>("confirm-ok");

const toastEl = byId<HTMLDivElement>("toast");

const themeBtn = byId<HTMLButtonElement>("theme-btn");
const themeIcon = themeBtn.querySelector<HTMLElement>("[data-icon]");

const drawerQuery = window.matchMedia("(max-width: 720px)");

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let docs: Doc[] = [];
let activeId: string | null = null;
let fileName: string | null = null;
let pendingSave = false;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let savedStatusTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

function toast(message: string, isError = false): void {
  toastEl.textContent = message;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

/* ------------------------------------------------------------------ */
/* Active document                                                     */
/* ------------------------------------------------------------------ */

function activeDoc(): Doc | undefined {
  return docs.find((d) => d.id === activeId);
}

function displayTitle(doc: Doc): string {
  if (doc.name) return doc.name;
  const firstLine = doc.text.split("\n")[0]!.trim();
  return firstLine || "Untitled";
}

function relativeTime(t: number): string {
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function saveStore(): void {
  if (activeId && docs.length > 0) saveDocs({ activeId, docs });
}

function persistCurrent(): boolean {
  const doc = activeDoc();
  if (!doc) return false;
  if (pendingSave) {
    doc.text = editor.value;
    doc.updatedAt = Date.now();
    pendingSave = false;
    saveStore();
    return true;
  }
  return false;
}

function scheduleAutosave(): void {
  pendingSave = true;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (persistCurrent()) {
      flashSaved("Auto-saved");
      renderDocList();
    }
  }, 450);
}

function flushAutosave(): void {
  clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
  persistCurrent();
}

/* ------------------------------------------------------------------ */
/* Stats, title, status                                                */
/* ------------------------------------------------------------------ */

function updateStats(): void {
  const s = getStats(editor.value);
  statLines.textContent = plural(s.lines, "line");
  statWords.textContent = plural(s.words, "word");
  statChars.textContent = plural(s.chars, "character");
}

function updateFileName(): void {
  if (fileName) {
    fileNameEl.textContent = fileName;
    fileNameEl.title = fileName;
    fileNameEl.hidden = false;
  } else {
    fileNameEl.hidden = true;
  }
  const doc = activeDoc();
  document.title = doc ? `${displayTitle(doc)} — EdiText` : "EdiText";
}

function flashSaved(message: string): void {
  saveTextEl.textContent = message;
  saveStatusEl.classList.add("show");
  clearTimeout(savedStatusTimer);
  savedStatusTimer = setTimeout(() => saveStatusEl.classList.remove("show"), 2200);
}

function onEditorChanged(): void {
  updateStats();
  const doc = activeDoc();
  if (doc) doc.text = editor.value;
  scheduleAutosave();
  updateActiveItemLive();
}

function updateActiveItemLive(): void {
  const li = activeId ? docList.querySelector<HTMLElement>(`.doc-item[data-id="${activeId}"]`) : null;
  const doc = activeDoc();
  if (!li || !doc) return;
  li.querySelector(".doc-title")!.textContent = displayTitle(doc);
  li.querySelector(".doc-meta")!.textContent = relativeTime(doc.updatedAt);
}

/** Replace the whole document while keeping native undo/redo working. */
function replaceEditorText(text: string): void {
  editor.focus();
  let done = false;
  try {
    if (document.execCommand("selectAll", false)) {
      done =
        text === ""
          ? document.execCommand("delete", false)
          : document.execCommand("insertText", false, text);
    }
  } catch {
    done = false;
  }
  if (!done) editor.value = text;
  onEditorChanged();
}

/* ------------------------------------------------------------------ */
/* Sidebar list                                                        */
/* ------------------------------------------------------------------ */

function renderDocList(): void {
  const sorted = [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
  docList.textContent = "";
  for (const doc of sorted) {
    const item = document.createElement("li");
    item.className = "doc-item" + (doc.id === activeId ? " active" : "");
    item.dataset.id = doc.id;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(doc.id === activeId));
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="doc-item-main">
        <span class="doc-title"></span>
        <span class="doc-meta"></span>
      </div>
      <button type="button" class="doc-delete" title="Delete document" aria-label="Delete document">
        <span class="ic" data-icon="trash"></span>
      </button>`;
    (item.querySelector(".doc-title") as HTMLElement).textContent = displayTitle(doc);
    (item.querySelector(".doc-meta") as HTMLElement).textContent = relativeTime(doc.updatedAt);
    const del = item.querySelector<HTMLButtonElement>(".doc-delete")!;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteDocument(doc.id);
    });
    item.addEventListener("click", () => switchToDoc(doc));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        switchToDoc(doc);
      }
    });
    docList.appendChild(item);
  }
  injectIcons(docList);
}

/* ------------------------------------------------------------------ */
/* Document actions                                                    */
/* ------------------------------------------------------------------ */

function loadDocIntoEditor(doc: Doc): void {
  editor.value = doc.text;
  updateStats();
}

function switchToDoc(doc: Doc): void {
  flushAutosave();
  activeId = doc.id;
  fileName = doc.name;
  loadDocIntoEditor(doc);
  updateFileName();
  renderDocList();
  saveStore();
  closeSidebarDrawer();
  editor.focus();
}

function createDocument(): void {
  flushAutosave();
  const doc: Doc = { id: uid(), name: null, text: "", updatedAt: Date.now() };
  docs.unshift(doc);
  activeId = doc.id;
  fileName = null;
  loadDocIntoEditor(doc);
  updateFileName();
  saveStore();
  renderDocList();
  closeSidebarDrawer();
  editor.focus();
  toast("New document");
}

async function clearCurrentDocument(): Promise<void> {
  if (editor.value === "") return;
  const ok = await confirmAction("Clear the editor?", "All current text will be removed.", "Clear");
  if (!ok) return;
  replaceEditorText("");
  saveStatusEl.classList.remove("show");
  editor.focus();
  toast("Editor cleared");
}

async function deleteDocument(id: string): Promise<void> {
  const doc = docs.find((d) => d.id === id);
  if (!doc) return;
  if (doc.text !== "") {
    const ok = await confirmAction(
      "Delete this document?",
      `"${displayTitle(doc)}" will be removed from your device.`,
      "Delete"
    );
    if (!ok) return;
  }
  const wasActive = id === activeId;
  if (wasActive) flushAutosave();
  docs = docs.filter((d) => d.id !== id);
  if (docs.length === 0) {
    const fresh: Doc = { id: uid(), name: null, text: "", updatedAt: Date.now() };
    docs.push(fresh);
  }
  if (wasActive) {
    activeId = null;
    switchToDoc(docs[0]!);
  } else {
    saveStore();
    renderDocList();
  }
  toast("Document deleted");
}

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

async function copyToClipboard(text: string): Promise<boolean> {
  if (text === "") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      const ok = document.execCommand("copy");
      scratch.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function copyAll(): Promise<void> {
  const ok = await copyToClipboard(editor.value);
  if (ok) {
    toast("Copied");
  } else {
    editor.select();
    toast("Unable to copy automatically. Select the text and copy it manually.", true);
  }
}

/* ------------------------------------------------------------------ */
/* Save / open                                                         */
/* ------------------------------------------------------------------ */

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function saveFile(): void {
  const base = (fileName ?? "untitled.txt").trim() || "untitled.txt";
  const name = /\.txt$/i.test(base) ? base : `${base}.txt`;
  download(name, editor.value);
  toast(`Saved ${name}`);
}

function isAcceptableTextFile(file: File): boolean {
  if (/\.txt$/i.test(file.name)) return true;
  return file.type === "text/plain" || file.type === "";
}

function openFile(file: File): void {
  if (!isAcceptableTextFile(file)) {
    toast("Please open a .txt file.", true);
    return;
  }
  file
    .text()
    .then((text) => {
      flushAutosave();
      const base = file.name.replace(/[\\/]/g, "").slice(0, 120) || null;
      const doc: Doc = { id: uid(), name: base, text, updatedAt: Date.now() };
      docs.unshift(doc);
      activeId = doc.id;
      fileName = base;
      loadDocIntoEditor(doc);
      updateFileName();
      saveStore();
      renderDocList();
      closeSidebarDrawer();
      toast(`Opened ${base ?? "file"}`);
    })
    .catch(() => toast("That file could not be read.", true));
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

let confirmResolve: ((ok: boolean) => void) | null = null;
let lastFocused: HTMLElement | null = null;

function confirmAction(title: string, message: string, okLabel: string): Promise<boolean> {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = okLabel;
  return new Promise<boolean>((resolve) => {
    confirmResolve = resolve;
    openLayer(confirmOverlay, confirmOk);
  }).finally(() => {
    closeLayer(confirmOverlay);
  });
}

confirmCancel.addEventListener("click", () => settleConfirm(false));
confirmOk.addEventListener("click", () => settleConfirm(true));
confirmOverlay.addEventListener("mousedown", (e) => {
  if (e.target === confirmOverlay) settleConfirm(false);
});

function settleConfirm(ok: boolean): void {
  confirmOverlay.classList.remove("open");
  const resolve = confirmResolve;
  confirmResolve = null;
  resolve?.(ok);
}

/* ------------------------------------------------------------------ */
/* Layer management (modals)                                           */
/* ------------------------------------------------------------------ */

function openLayer(layer: HTMLElement, focusTarget?: HTMLElement | null): void {
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  layer.hidden = false;
  void layer.offsetWidth;
  layer.classList.add("open");
  focusTarget?.focus();
}

function closeLayer(layer: HTMLElement, restoreFocus = true): void {
  layer.classList.remove("open");
  setTimeout(() => {
    layer.hidden = true;
  }, 300);
  if (restoreFocus && lastFocused?.isConnected) {
    lastFocused.focus();
    lastFocused = null;
  }
}

function anyOpenLayer(): HTMLElement | null {
  if (!confirmOverlay.hidden) return confirmOverlay;
  return null;
}

function trapFocus(layer: HTMLElement, e: KeyboardEvent): void {
  const focusables = Array.from(
    layer.querySelectorAll<HTMLElement>('button, textarea, input, [tabindex]:not([tabindex="-1"])')
  ).filter((el) => !el.hasAttribute("disabled"));
  if (focusables.length === 0) return;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ------------------------------------------------------------------ */
/* One-Liner panel                                                     */
/* ------------------------------------------------------------------ */

function runConversion(): void {
  olOutput.value = toOneLiner(olInput.value);
}

olInput.addEventListener("input", runConversion);

olCopy.addEventListener("click", async () => {
  if (olOutput.value === "") {
    toast("Nothing to copy yet.", true);
    return;
  }
  const ok = await copyToClipboard(olOutput.value);
  if (ok) toast("Copied");
  else toast("Unable to copy automatically. Select the result and copy it manually.", true);
});

/* ------------------------------------------------------------------ */
/* Drag & drop                                                         */
/* ------------------------------------------------------------------ */

let dragDepth = 0;

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

document.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  dragDepth += 1;
  document.body.classList.add("dragging");
});

document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove("dragging");
});

document.addEventListener("drop", (e) => {
  dragDepth = 0;
  document.body.classList.remove("dragging");
  const file = e.dataTransfer?.files[0];
  if (file) openFile(file);
});

window.addEventListener("blur", () => {
  dragDepth = 0;
  document.body.classList.remove("dragging");
});

/* ------------------------------------------------------------------ */
/* Retractable columns (sidebar left / one-liner right)                */
/* ------------------------------------------------------------------ */

interface PanelPrefs {
  sidebarCollapsed: boolean;
  onelinerCollapsed: boolean;
}

const PANEL_KEY = "editext.panels.v1";
let panelPrefs: PanelPrefs = { sidebarCollapsed: false, onelinerCollapsed: false };

function loadPanelPrefs(): PanelPrefs {
  try {
    const raw = localStorage.getItem(PANEL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PanelPrefs>;
      return {
        sidebarCollapsed: !!p.sidebarCollapsed,
        onelinerCollapsed: !!p.onelinerCollapsed,
      };
    }
  } catch {
    /* noop */
  }
  return { sidebarCollapsed: false, onelinerCollapsed: false };
}

function savePanelPrefs(): void {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(panelPrefs));
  } catch {
    /* noop */
  }
}

function applyPanelState(): void {
  sidebar.classList.toggle("collapsed", panelPrefs.sidebarCollapsed);
  onelinerPanel.classList.toggle("collapsed", panelPrefs.onelinerCollapsed);
}

function openSidebarDrawer(): void {
  if (!drawerQuery.matches) return;
  sidebar.classList.add("open");
  sidebarScrim.classList.add("open");
  sidebarToggle.setAttribute("aria-expanded", "true");
  const activeItem = docList.querySelector<HTMLElement>(".doc-item.active");
  (activeItem ?? sidebar).focus();
}

function closeSidebarDrawer(): void {
  if (!drawerQuery.matches) return;
  sidebar.classList.remove("open");
  sidebarScrim.classList.remove("open");
  sidebarToggle.setAttribute("aria-expanded", "false");
}

sidebarToggle.addEventListener("click", () => {
  if (drawerQuery.matches) {
    if (sidebar.classList.contains("open")) closeSidebarDrawer();
    else openSidebarDrawer();
    return;
  }
  panelPrefs.sidebarCollapsed = !panelPrefs.sidebarCollapsed;
  savePanelPrefs();
  applyPanelState();
});
sidebarScrim.addEventListener("click", closeSidebarDrawer);

function toggleOneLinerPanel(): void {
  const wasCollapsed = panelPrefs.onelinerCollapsed;
  panelPrefs.onelinerCollapsed = !wasCollapsed;
  savePanelPrefs();
  applyPanelState();
  if (wasCollapsed) olInput.focus();
}

olHideBtn.addEventListener("click", toggleOneLinerPanel);
oneLinerBtn.addEventListener("click", toggleOneLinerPanel);

/* ------------------------------------------------------------------ */
/* Theme (day / night)                                                 */
/* ------------------------------------------------------------------ */

const THEME_KEY = "editext.theme";
const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark", persist: boolean): void {
  document.documentElement.dataset.theme = theme;
  const iconName = theme === "light" ? "moon" : "sun"; // shows the mode you'll switch to
  if (themeIcon) {
    themeIcon.dataset.icon = iconName;
    themeIcon.innerHTML = icons[iconName]!;
  }
  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
  themeBtn.title = label;
  themeBtn.setAttribute("aria-label", label);
  themeColorMeta?.setAttribute("content", theme === "dark" ? "#1C1A15" : "#F7F3EA");
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }
}

themeBtn.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
});

/* ------------------------------------------------------------------ */
/* Toolbar wiring                                                      */
/* ------------------------------------------------------------------ */

newBtn.addEventListener("click", createDocument);
newDocBtn.addEventListener("click", createDocument);
clearBtn.addEventListener("click", () => void clearCurrentDocument());
openBtn.addEventListener("click", () => fileInput.click());
saveBtn.addEventListener("click", saveFile);
copyBtn.addEventListener("click", () => void copyAll());

editor.addEventListener("input", onEditorChanged);

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) openFile(file);
  fileInput.value = "";
});

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts                                                  */
/* ------------------------------------------------------------------ */

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;

  if (e.key === "Escape") {
    if (sidebar.classList.contains("open")) {
      closeSidebarDrawer();
      return;
    }
    if (!confirmOverlay.hidden) {
      settleConfirm(false);
    }
    return;
  }

  if (!meta) {
    if (e.key === "Tab") {
      const layer = anyOpenLayer();
      if (layer) trapFocus(layer, e);
    }
    return;
  }

  const key = e.key.toLowerCase();
  if (key === "s" && !e.shiftKey) {
    e.preventDefault();
    saveFile();
  } else if (key === "n") {
    e.preventDefault();
    createDocument();
  } else if (key === "l" && e.shiftKey) {
    e.preventDefault();
    toggleOneLinerPanel();
  }
});

window.addEventListener("beforeunload", flushAutosave);

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

injectIcons();
applyTheme(currentTheme(), false);
panelPrefs = loadPanelPrefs();
applyPanelState();
updateStats();

const loaded = loadDocs();
if (loaded && loaded.docs.length > 0) {
  docs = loaded.docs;
  activeId = loaded.activeId;
  const active = activeDoc() ?? docs[0]!;
  activeId = active.id;
  fileName = active.name;
  loadDocIntoEditor(active);
  if (active.text !== "") flashSaved("Draft restored");
} else {
  const doc: Doc = { id: uid(), name: null, text: "", updatedAt: Date.now() };
  docs = [doc];
  activeId = doc.id;
  saveStore();
}
updateFileName();
renderDocList();
