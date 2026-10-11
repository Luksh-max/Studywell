import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(projectRoot, "web");
const javascriptFiles = [
  "js/app.js",
  "js/storage.js",
  "sw.js"
];
const requiredFiles = [
  "index.html",
  "manifest.json",
  "_headers",
  "css/styles.css",
  "js/app.js",
  "js/storage.js",
  "sw.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(webRoot, relativePath))) {
    fail(`Required web asset is missing: ${relativePath}`);
  }
}

for (const relativePath of javascriptFiles) {
  const filePath = path.join(webRoot, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`JavaScript syntax check failed for ${relativePath}: ${result.stderr}`);
  }
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, "manifest.json"), "utf8"));
  if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.display) {
    fail("The PWA manifest is missing required install metadata.");
  }
  for (const icon of manifest.icons || []) {
    if (!fs.existsSync(path.join(webRoot, icon.src))) {
      fail(`Manifest icon is missing: ${icon.src}`);
    }
  }
} catch (error) {
  fail(`The PWA manifest is not valid JSON: ${error.message}`);
}

const html = fs.readFileSync(path.join(webRoot, "index.html"), "utf8");
for (const localAsset of ["./manifest.json", "./css/styles.css", "./js/storage.js", "./js/app.js"]) {
  if (!html.includes(localAsset)) fail(`index.html does not reference ${localAsset}`);
}


const css = fs.readFileSync(path.join(webRoot, "css/styles.css"), "utf8");
if ((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) {
  fail("CSS braces are unbalanced.");
}

const htmlDoctypes = (html.match(/<!doctype html>/gi) || []).length;
if (htmlDoctypes !== 1) {
  fail("index.html must contain exactly one HTML doctype.");
}

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
for (const relativePath of ["index.html", "css/styles.css", "js/app.js", "js/storage.js", "sw.js", "manifest.json"]) {
  const source = fs.readFileSync(path.join(webRoot, relativePath), "utf8");
  if (emojiPattern.test(source)) {
    fail(`Emoji or pictographic glyph found in ${relativePath}.`);
  }
  const longestLine = Math.max(...source.split("\n").map((line) => line.length));
  if (longestLine > 500) {
    fail(`${relativePath} has a line longer than 500 characters; keep source readable.`);
  }
}

const allWebSource = requiredFiles
  .filter((file) => /\.(html|css|js|json|svg)$/.test(file))
  .map((file) => fs.readFileSync(path.join(webRoot, file), "utf8"))
  .join("\n");
if (/https?:\/\/(?!www\.w3\.org)/i.test(allWebSource)) {
  fail("An external URL was found in the web app source. StudyWell must remain offline-first.");
}

if (process.exitCode) process.exit(process.exitCode);
console.log("PASS: required assets, JavaScript syntax, PWA manifest and local-source checks.");
