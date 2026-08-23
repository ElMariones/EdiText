# EdiText

EdiText is a minimalist plain-text editor for `.txt` files with one signature extra: a **Text → One-Liner** converter that collapses multiline text into a single continuous line. It runs entirely in your browser — no backend, no accounts, no tracking.

## Features

- **Minimal plain-text editor** — a distraction-free writing surface. No fonts, no formatting, no clutter.
- **Three-column layout** — the editor sits centered between a **documents sidebar** on the left and a **One-Liner panel** on the right. Both columns are equal-width and retractable via their own in-column toggle button (which flips direction to reopen), the toolbar toggles, or <kbd>⌘/Ctrl ⇧ L</kbd>.
- **Aspects** — a palette button opens the aspect picker: five **tones** (cream, blue, green, red, white) each with day and night modes, plus four overhauled **styles** (Cyberpunk, Windows 98, Paper, Console). Tones and styles are independent and remembered.
- **Documents sidebar** — every draft and opened file is kept on the left (a slide-in drawer on mobile); switch between them instantly, and each one autosaves independently.
- **Live statistics** — lines · words · characters, updated on every keystroke.
- **One-Liner panel** — paste multiline text on the right, get it back as one line automatically as you type (handles `\r\n`, `\r`, `\n`, and blank-line runs), then copy the result.
- **Day / night mode** — a toolbar toggle switches between warm light and dark themes; your preference is remembered.
- **Open & save `.txt`** — everything happens locally via the File API and Blob downloads.
- **Drag & drop** — drop a `.txt` file anywhere on the page to open it.
- **Autosave** — your draft is preserved in `localStorage` (debounced) and restored on reload.
- **Copy** — one click copies the whole document or just the one-liner result.
- **Keyboard shortcuts** — native editing behavior plus app-level save/open-converter shortcuts.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>⌘/Ctrl</kbd> + <kbd>S</kbd> | Download the document as `.txt` |
| <kbd>⌘/Ctrl</kbd> + <kbd>N</kbd> | Create a new document |
| <kbd>⌘/Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>L</kbd> | Show / hide the One-Liner panel |
| <kbd>Esc</kbd> | Close the documents drawer / cancel confirmation |
| <kbd>⌘/Ctrl</kbd> + <kbd>A/C/X/V/Z</kbd> | Native select, copy, cut, paste, undo |

## Run locally

```bash
npm install
npm run dev       # dev server at http://localhost:5173
```

## Build for production

```bash
npm run build     # type-checks, then outputs static files to dist/
npm run preview   # serve the production build locally
npm test          # run the conversion/stats logic checks
```

## Deploying to GitHub Pages

Deployment is automated with GitHub Actions (`.github/workflows/deploy.yml`). Every push to `main` builds the site and deploys it to:

```
https://<owner>.github.io/EdiText/
```

The Vite `base` is set to `/EdiText/` in `vite.config.ts` to match the project-page URL. Make sure **Settings → Pages → Source → GitHub Actions** is enabled on the repository.

## Project structure

```
EdiText/
├── .github/workflows/deploy.yml   # Build + deploy to GitHub Pages
├── index.html                     # App markup (single page)
├── public/favicon.svg             # Brand mark
├── src/
│   ├── main.ts                    # App wiring: editor, panels, shortcuts, DnD
│   ├── convert.ts                 # Text → One-Liner transformation
│   ├── stats.ts                   # Lines / words / characters counters
│   ├── storage.ts                 # localStorage draft persistence
│   ├── icons.ts                   # Inline SVG icon set
│   └── style.css                  # Design system (cream + glassmorphism)
├── vite.config.ts                 # base: /EdiText/
└── tsconfig.json
```

## Browser support

Modern Safari, Chrome, Firefox, and Edge. Glassmorphism degrades gracefully where `backdrop-filter` is unavailable, and clipboard access falls back to a legacy path when needed.

## Privacy

All text stays in your browser. Nothing is uploaded, logged, or shared — autosave uses only your device's `localStorage`.
