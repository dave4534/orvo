#!/usr/bin/env node
// npm run audit:ui
// Reports violations of the design system rule in CLAUDE.md. Exits 1 if anything is found.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const UI_DIR = join(SRC, "components", "ui");

const RAW = ["button", "input", "select", "textarea", "table", "dialog"];
// Allowed for UI: @/components/ui/*, @base-ui/react, lucide-react. Anything matching below is flagged.
const UI_LIKE_IMPORT = [
  /^@radix-ui\//, /^radix-ui$/, /^@mui\//, /^@chakra-ui\//, /^@mantine\//, /^@headlessui\//,
  /^@ark-ui\//, /^@nextui-org\//, /^@heroui\//, /^@ariakit\//, /^react-aria/, /^@react-aria\//,
  /^antd$/, /^primereact/, /^react-bootstrap/, /^@fluentui\//, /^@blueprintjs\//,
  /^@mondaydotcomorg\//, /^monday-ui-react-core/, /^react-icons/, /^@heroicons\//, /^@phosphor-icons\//,
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p);
const files = walk(SRC);
const code = files.filter((f) => [".ts", ".tsx"].includes(extname(f)));
const outsideUi = code.filter((f) => !f.startsWith(UI_DIR));

// 1. Raw interactive elements outside components/ui
const rawHits = [];
for (const f of outsideUi.filter((f) => f.endsWith(".tsx"))) {
  const text = readFileSync(f, "utf8");
  for (const tag of RAW) {
    const re = new RegExp(`<${tag}[\\s>/]`, "g");
    const n = (text.match(re) || []).length;
    if (n) rawHits.push(`${rel(f)}: <${tag}> x${n}`);
  }
}

// 2. Non-shadcn UI imports (anywhere in src)
const importHits = [];
for (const f of code) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    if (UI_LIKE_IMPORT.some((r) => r.test(spec))) importHits.push(`${rel(f)}: ${spec}`);
  }
}

// 3. Custom .css files (only src/tailwind.css is allowed)
const cssHits = files
  .filter((f) => extname(f) === ".css" && rel(f) !== join("src", "tailwind.css"))
  .map(rel);

// 4. Components not registered in docs
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const registry = read(join(ROOT, "docs", "components.md")) + "\n" + read(join(ROOT, "docs", "exceptions.md"));
const componentFiles = files
  .filter((f) => f.startsWith(join(SRC, "components")) && f.endsWith(".tsx"))
  .map((f) => basename(f, ".tsx"));
const unregistered = componentFiles.filter((name) => !new RegExp(`\\b${name}\\b`).test(registry));

const section = (title, list) => {
  console.log(`\n${title}: ${list.length}`);
  for (const l of list) console.log(`  - ${l}`);
};

console.log("audit:ui");
section("Raw interactive elements outside src/components/ui", rawHits);
section("Non-shadcn UI imports", importHits);
section("Custom .css files", cssHits);
section("Components not listed in docs/components.md or docs/exceptions.md", unregistered);

const total = rawHits.length + importHits.length + cssHits.length + unregistered.length;
console.log(total === 0 ? "\nCLEAN" : `\nNOT CLEAN (${total} issue${total === 1 ? "" : "s"})`);
process.exit(total === 0 ? 0 : 1);
