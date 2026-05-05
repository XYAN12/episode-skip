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
        content: resolve("src/content.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js"
      }
    }
  },
  test: {
    environment: "node"
  }
});
