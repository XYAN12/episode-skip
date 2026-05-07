import { defineConfig } from "vite";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync(resolve("dist"), { recursive: true });
        copyFileSync(resolve("manifest.json"), resolve("dist/manifest.json"));
        cpSync(resolve("logo"), resolve("dist/logo"), {
          recursive: true,
          filter: (sourcePath) => basename(sourcePath) !== ".DS_Store"
        });
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
