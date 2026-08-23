import { defineConfig } from "vite";

// The repository name is `EdiText`, so GitHub Pages serves the site from
// https://<owner>.github.io/EdiText/ — the base must match that sub-path.
export default defineConfig({
  base: "/EdiText/",
});
