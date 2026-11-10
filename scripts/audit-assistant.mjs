// Checks that every control in src/logic/assistant-tools.ts is wired up everywhere the assistant needs it.
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const registry = read("src/logic/assistant-tools.ts");
const names = [...registry.matchAll(/\{ name: "(\w+)"/g)].map((m) => m[1]);
const places = {
  "server tool (src/server/ui-tools.ts)": [read("src/server/ui-tools.ts"), (n) => new RegExp(`(tools\\.${n}\\b|\\b${n}: tool\\()`)],
  "screen handler (claims-view.tsx)": [read("src/features/claims/claims-view.tsx"), (n) => new RegExp(`case "${n}"`)],
  "step label (chat-steps.tsx)": [read("src/features/claims/chat-steps.tsx"), (n) => new RegExp(`"tool-${n}"`)],
  "prompt (chat-prompt.ts)": [read("src/server/chat-prompt.ts"), (n) => new RegExp(`\\b${n}\\b`)],
  "capability doc (docs/assistant-capabilities.md)": [read("docs/assistant-capabilities.md"), (n) => new RegExp(`\\b${n}\\b`)],
};

let problems = 0;
for (const n of names) {
  for (const [where, [text, test]] of Object.entries(places)) {
    if (!test(n).test(text)) {
      console.log(`MISSING  ${n}: not in ${where}`);
      problems++;
    }
  }
}
// The reverse: a handler case with no registry entry.
const view = read("src/features/claims/claims-view.tsx");
const handler = view.slice(view.indexOf("setUiToolHandler(async"), view.indexOf("setUiToolHandler(null)"));
for (const m of handler.matchAll(/case "(\w+)":/g)) {
  if (!names.includes(m[1])) {
    console.log(`UNREGISTERED  handler case ${m[1]} is not in the registry`);
    problems++;
  }
}
console.log(problems === 0 ? `Assistant audit clean: ${names.length} controls, each wired in ${Object.keys(places).length} places.` : `${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
