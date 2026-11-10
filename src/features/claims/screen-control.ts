/**
 * Generic hands for the assistant: see every control that is visible right now, press one by its label, and type into a field.
 * This covers everything the specific tools do not: menus, filter dropdowns, the steps of a dialog, checkboxes, tabs.
 * It works on what is on screen, so a new control is reachable the moment it exists. Browser only.
 */

const CONTROLS = 'button,[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=checkbox],[role=radio],[role=option],[role=switch],[role=combobox],a[href]';
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]';
const LAYERS = '[role=menu],[role=listbox],[role=dialog],[role=alertdialog],[data-slot=popover-content]';
const ASSISTANT = 'aside[aria-label="Ask Orvo AI"]';

const isVisible = (el: Element) => {
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && el.getClientRects().length > 0;
};

/** What a person would call the control: its accessible name, or the first line of its text. */
function labelOf(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();
  const first = (t: string | null | undefined) => (t ?? "").split("\n")[0].replace(/\s+/g, " ").trim();
  const text = first((el as HTMLElement).innerText);
  if (text) return text;
  // Radios and checkboxes are named by a label that wraps them or points at them.
  const ids = el.getAttribute("aria-labelledby")?.split(" ") ?? [];
  const named = ids.map((id) => first(document.getElementById(id)?.innerText)).find(Boolean);
  if (named) return named;
  const id = el.getAttribute("id");
  const forLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  return first((forLabel ?? el.closest("label"))?.textContent?.replace(/([a-z.])([A-Z])/g, "$1\n$2"));
}

/** The part of the page that can be used right now: the open menu or dialog if there is one, otherwise the whole page. */
function scope(): ParentNode {
  const layers = [...document.querySelectorAll(LAYERS)].filter((l) => isVisible(l) && !l.closest(ASSISTANT));
  return layers[layers.length - 1] ?? document;
}

function usable(el: Element) {
  if (el.closest(ASSISTANT) || el.closest("[aria-hidden=true]") || el.closest("[inert]")) return false;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return false;
  return isVisible(el);
}

export function visibleControls(): { label: string; kind: string; el: Element }[] {
  const seen = new Set<string>();
  const out: { label: string; kind: string; el: Element }[] = [];
  for (const el of scope().querySelectorAll(CONTROLS)) {
    if (!usable(el)) continue;
    const label = labelOf(el);
    if (!label) continue;
    const kind = el.getAttribute("role") ?? (el.tagName === "A" ? "link" : "button");
    const key = `${kind}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, kind, el });
  }
  return out;
}

/** Short list for the model: labels only, with the kind where it is not a plain button. */
export function controlSummary(max = 70): string[] {
  return visibleControls()
    .slice(0, max)
    .map((c) => (c.kind === "button" ? c.label : `${c.label} (${c.kind})`).slice(0, 70));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const settle = () => new Promise((r) => setTimeout(r, 450));

export async function pressControl(label: string): Promise<Record<string, unknown>> {
  const want = norm(label);
  const all = visibleControls();
  const exact = all.filter((c) => norm(c.label) === want);
  const matches = exact.length > 0 ? exact : all.filter((c) => norm(c.label).includes(want) || want.includes(norm(c.label)));
  if (matches.length === 0) return { ok: false, error: `No visible control called "${label}".`, visible: controlSummary(40) };
  if (matches.length > 1) return { ok: false, error: `More than one control matches "${label}": ${matches.slice(0, 6).map((m) => m.label).join("; ")}. Use the exact label.` };
  const { el } = matches[0];
  (el as HTMLElement).click();
  await settle();
  return { ok: true, pressed: matches[0].label, nowVisible: controlSummary(40) };
}

function fieldLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const id = el.getAttribute("id");
  const labelled = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  return labelled?.textContent ?? el.getAttribute("placeholder") ?? "";
}

export async function typeInField(label: string, text: string): Promise<Record<string, unknown>> {
  const want = norm(label);
  const fields = [...scope().querySelectorAll(FIELDS)].filter((el) => usable(el));
  const matches = fields.filter((el) => norm(fieldLabel(el)).includes(want) || (want === "" && fields.length === 1));
  if (matches.length === 0) return { ok: false, error: `No visible field called "${label}".`, fields: fields.map((f) => fieldLabel(f)).filter(Boolean) };
  if (matches.length > 1) return { ok: false, error: `More than one field matches "${label}".` };
  const el = matches[0] as HTMLInputElement | HTMLTextAreaElement;
  el.focus();
  if (el.isContentEditable) {
    el.textContent = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await settle();
  return { ok: true, typed: text, into: fieldLabel(el) };
}

/** What is on screen that can be used right now, with the text of an open dialog. */
export function lookAtScreen(): Record<string, unknown> {
  const layers = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter((l) => isVisible(l) && !l.closest(ASSISTANT));
  const top = layers[layers.length - 1] as HTMLElement | undefined;
  return { ok: true, openDialogText: top ? top.innerText.replace(/\s+/g, " ").slice(0, 900) : null, controls: controlSummary(60) };
}
