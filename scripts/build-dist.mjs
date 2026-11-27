/* Zero-dependency production build script for BunnyHub.
   Copies public web assets into dist/ with CSS minification and compact JS stripping (no SQL/docs/source maps). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const PUBLIC_FILES = [
  "index.html",
  "privacy.html",
  "terms.html",
  "copyright.html",
  "cookie-policy.html",
  "robots.txt",
  "sitemap.xml",
  "_headers"
];

const PUBLIC_DIRS = ["css", "js"];

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function compactJs(code) {
  return code
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("//"))
    .join("\n") + "\n";
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of PUBLIC_FILES) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, file));
}

for (const dir of PUBLIC_DIRS) {
  const srcDir = path.join(root, dir);
  const dstDir = path.join(dist, dir);
  fs.mkdirSync(dstDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const srcFile = path.join(srcDir, name);
    const dstFile = path.join(dstDir, name);
    if (!fs.statSync(srcFile).isFile()) continue;
    const raw = fs.readFileSync(srcFile, "utf8");
    if (name.endsWith(".css")) fs.writeFileSync(dstFile, minifyCss(raw), "utf8");
    else if (name.endsWith(".js")) fs.writeFileSync(dstFile, compactJs(raw), "utf8");
    else fs.copyFileSync(srcFile, dstFile);
  }
}

console.log("Clean production dist/ generated (no SQL/docs/source maps included).");
