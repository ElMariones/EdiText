import "./style.css";
import { injectIcons } from "./icons";
import { toOneLiner } from "./convert";
import { getStats } from "./stats";
import { clearStoredDraft, loadDraft, saveDraft } from "./storage";

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

const olOverlay = byId<HTMLDivElement>("ol-overlay");
const olClose = byId<HTMLButtonElement>("ol-close");
const olInput = byId<HTMLTextAreaElement>("ol-input");
const olOutput = byId<HTMLTextAreaElement>("ol-output");
const olConvert = byId<HTMLButtonElement>("ol-convert");
const olCopy = byId<HTMLButtonElement>("ol-copy");

const confirmOverlay = byId<HTMLDivElement>("confirm-overlay");
const confirmTitle = byId<HTMLElement>("confirm-title");
const confirmMessage = byId<HTMLElement>("confirm-message");
const confirmCancel = byId<HTMLButtonElement>("confirm-cancel");
const confirmOk = byId<HTMLButtonElement>("confirm-ok");

const toastEl = byId<HTMLDivElement>("toast");

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let fileName: string | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let savedStatusTimer: ReturnType<typeof setTimeout> | undefined;

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function toast(message: string, isError = false): void {
  toastEl.textContent = message;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}/* ------------------------------------------------------------------ */
/* Stats + autosave                                                    */
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
  document.title = fileName
    ? `${fileName} — EdiText`
    : "EdiText — Simple text. Nothing else.";
}

function flashSaved(message: string): void {
  saveTextEl.textContent = message;
  saveStatusEl.classList.add("show");
  clearTimeout(savedStatusTimer);
  savedStatusTimer = setTimeout(() => saveStatusEl.classList.remove("show"), 2200);
}

function scheduleAutosave(): void {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveDraft({ name: fileName, text: editor.value });
    flashSaved("Auto-saved");
  }, 450);
}

/** Replace the whole document while keeping native undo/redo working. */
function replaceEditorText(text: string): void {
  editor.focus();
  let done = false;
  try {
    if (document.execCommand("selectAll", false)) {
      // insertText("") is a no-op in some engines, so delete explicitly.
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

function onEditorChanged(): void {
  updateStats();
  scheduleAutosave();
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
    // Fallback for older Safari or blocked permissions.
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
      replaceEditorText(text);
      fileName = file.name.replace(/[\\/]/g, "").slice(0, 120) || null;
      updateFileName();
      onEditorChanged();
      toast(`Opened ${fileName ?? "file"}`);
    })
    .catch(() => toast("That file could not be read.", true));
}

/* ------------------------------------------------------------------ */
/* New / clear with confirmation                                       */
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

async function resetDocument(action: "new" | "clear"): Promise<void> {
  if (editor.value !== "") {
    const isNew = action === "new";
    const ok = await confirmAction(
      isNew ? "Create a new document?" : "Clear the editor?",
      isNew
        ? "Your current text will be removed from this document."
        : "All current text will be removed.",
      isNew ? "New document" : "Clear"
    );
    if (!ok) return;
  }
  replaceEditorText("");
  fileName = null;
  updateFileName();
  clearStoredDraft();
  saveStatusEl.classList.remove("show");
  editor.focus();
  toast(action === "new" ? "New document" : "Editor cleared");
}

/* ------------------------------------------------------------------ */
/* Layer management (modals)                                           */
/* ------------------------------------------------------------------ */

function openLayer(layer: HTMLElement, focusTarget?: HTMLElement | null): void {
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  layer.hidden = false;
  // Commit the hidden state before adding .open so the enter transition runs.
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
  if (!olOverlay.hidden) return olOverlay;
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
/* One-Liner modal                                                     */
/* ------------------------------------------------------------------ */

function runConversion(): void {
  olOutput.value = toOneLiner(olInput.value);
}

function openOneLiner(): void {
  openLayer(olOverlay, olInput);
}

olInput.addEventListener("input", runConversion);

olConvert.addEventListener("click", () => {
  if (olInput.value.trim() === "") {
    toast("Paste some multiline text first.", true);
    olInput.focus();
    return;
  }
  runConversion();
  olOutput.focus();
  olOutput.select();
});

olCopy.addEventListener("click", async () => {
  if (olOutput.value === "") {
    toast("Nothing to copy yet.", true);
    return;
  }
  const ok = await copyToClipboard(olOutput.value);
  if (ok) toast("Copied");
  else toast("Unable to copy automatically. Select the result and copy it manually.", true);
});

olClose.addEventListener("click", () => closeLayer(olOverlay));

olOverlay.addEventListener("mousedown", (e) => {
  if (e.target === olOverlay) closeLayer(olOverlay);
});

/* ------------------------------------------------------------------ */
/* Drag & drop                                                         */
/* ------------------------------------------------------------------ */

let dragDepth = 0;

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

document.addEventListener("dragenter", (e) => {
  if (!(e.dataTransfer?.types.includes("Files"))) return;
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

// Safety net if a drag ends outside the page (drop on browser UI, etc.).
window.addEventListener("blur", () => {
  dragDepth = 0;
  document.body.classList.remove("dragging");
});

/* ------------------------------------------------------------------ */
/* Toolbar wiring                                                      */
/* ------------------------------------------------------------------ */

newBtn.addEventListener("click", () => void resetDocument("new"));
clearBtn.addEventListener("click", () => void resetDocument("clear"));
openBtn.addEventListener("click", () => fileInput.click());
saveBtn.addEventListener("click", saveFile);
copyBtn.addEventListener("click", () => void copyAll());
oneLinerBtn.addEventListener("click", openOneLiner);

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
    const layer = anyOpenLayer();
    if (layer === confirmOverlay) {
      settleConfirm(false);
    } else if (layer === olOverlay) {
      closeLayer(olOverlay);
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
  } else if (key === "l" && e.shiftKey) {
    e.preventDefault();
    if (olOverlay.hidden) openOneLiner();
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

injectIcons();

updateStats();

const draft = loadDraft();
if (draft && draft.text !== "") {
  editor.value = draft.text;
  fileName = draft.name;
  updateFileName();
  updateStats();
  flashSaved("Draft restored");
}
