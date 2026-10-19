import { IT } from "./dictionary";
import { PATTERNS } from "./patterns";

/**
 * Translates what is on screen. Text the interface builds from words in code
 * (labels, messages, toasts, counts, attributes) is matched against the
 * dictionary and the patterns; text that comes from the database (names,
 * notes, addresses) is never in either, so it is left as it was written.
 */

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt", "aria-description"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "NOSCRIPT"]);

class Untranslatable extends Error {}

/** Italian for one piece of English interface text, or null when there is none. */
export function italianFor(text: string): string | null {
  const core = text.trim();
  if (!core) return null;
  const exact = IT[core];
  if (exact !== undefined) return exact;
  // "orders" after a verb: the dictionary has "Orders".
  const capital = core.charAt(0).toUpperCase() + core.slice(1);
  if (capital !== core && IT[capital] !== undefined) return IT[capital].toLowerCase();
  // `tr` needs the part to be known interface text; `tr.keep` lets names and ids through.
  const tr = Object.assign(
    (inner: string) => {
      const found = italianFor(inner);
      if (found === null) throw new Untranslatable();
      return found;
    },
    { keep: (inner: string) => italianFor(inner) ?? inner },
  );
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(core);
    if (!match) continue;
    try {
      return build(match, tr);
    } catch (error) {
      if (!(error instanceof Untranslatable)) throw error;
    }
  }
  return null;
}

function withSpacing(original: string, translated: string): string {
  const lead = /^\s*/.exec(original)?.[0] ?? "";
  const trail = /\s*$/.exec(original)?.[0] ?? "";
  return `${lead}${translated}${trail}`;
}

const originals = new WeakMap<Node, string>();
const translated = new WeakMap<Node, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

function translateTextNode(node: Text) {
  const current = node.nodeValue ?? "";
  // React rewrote the text since we last touched it: it is new English.
  if (translated.get(node) !== current) originals.set(node, current);
  const original = originals.get(node) ?? current;
  const italian = italianFor(original);
  if (italian === null) {
    translated.delete(node);
    return;
  }
  const next = withSpacing(original, italian);
  if (next !== current) node.nodeValue = next;
  translated.set(node, next);
}

function translateAttributes(element: Element) {
  for (const name of ATTRIBUTES) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    let known = attributeOriginals.get(element);
    if (!known) attributeOriginals.set(element, (known = new Map()));
    const previous = known.get(`t:${name}`);
    if (previous !== current) known.set(name, current);
    const original = known.get(name) ?? current;
    const italian = italianFor(original);
    if (italian === null) {
      known.delete(`t:${name}`);
      continue;
    }
    if (italian !== current) element.setAttribute(name, italian);
    known.set(`t:${name}`, italian);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!SKIP.has(root.parentElement?.tagName ?? "")) translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (element.hasAttribute("data-no-translate")) return;
  translateAttributes(element);
  if (SKIP.has(element.tagName)) return;
  for (const child of element.childNodes) walk(child);
}

function restore(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const original = originals.get(root);
    if (original !== undefined && translated.get(root) === root.nodeValue)
      root.nodeValue = original;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  const known = attributeOriginals.get(element);
  if (known) {
    for (const name of ATTRIBUTES) {
      const original = known.get(name);
      if (original !== undefined && element.getAttribute(name) === known.get(`t:${name}`)) {
        element.setAttribute(name, original);
      }
    }
  }
  for (const child of element.childNodes) restore(child);
}

/** Keeps `root` in Italian as it changes; the returned function stops and restores English. */
export function translateTree(root: HTMLElement): () => void {
  let queued = false;
  const pending = new Set<Node>();
  const flush = () => {
    queued = false;
    observer.disconnect();
    for (const node of pending) if (root.contains(node)) walk(node);
    pending.clear();
    observe();
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") pending.add(record.target);
      else if (record.type === "attributes") pending.add(record.target);
      else for (const added of record.addedNodes) pending.add(added);
    }
    if (!queued) {
      queued = true;
      queueMicrotask(flush);
    }
  });
  const observe = () =>
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
  walk(root);
  observe();
  return () => {
    observer.disconnect();
    restore(root);
  };
}
