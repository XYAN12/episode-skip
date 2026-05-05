import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync(resolve("dist"), { recursive: true });
        copyFileSync(resolve("manifest.json"), resolve("dist/manifest.json"));
      }
    }
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve("popup.html"),
        content: resolve("src/content.ts")
      },
      output: {
        entryFileNames: "assets/[name].js"
      }
    }
  },
  test: {
    environment: "node"
  }
});
