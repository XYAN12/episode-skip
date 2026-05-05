import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve("dist");
const manifestPath = resolve(distDir, "manifest.json");
const contentPath = resolve(distDir, "content.js");

if (!existsSync(manifestPath)) {
  throw new Error("dist/manifest.json is missing");
}

if (!existsSync(contentPath)) {
  throw new Error("dist/content.js is missing");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const contentScripts = manifest.content_scripts;
if (!Array.isArray(contentScripts) || contentScripts.length === 0) {
  throw new Error("manifest.content_scripts is missing");
}

const jsEntries = contentScripts[0]?.js;
if (!Array.isArray(jsEntries) || !jsEntries.includes("content.js")) {
  throw new Error("manifest.content_scripts[0].js must include content.js");
}

console.log("[youtube-intro-skip] dist validation passed");
