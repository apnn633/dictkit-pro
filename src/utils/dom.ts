// ============================================================
// utils/dom.ts — DOM helpers (typed)
// ============================================================

type Attrs = Record<string, unknown>;
type Child = Node | string | number | null | false | undefined | Child[];

/** Safe querySelector. */
export function $<T extends Element = Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

/** querySelectorAll → Array. */
export function $$<T extends Element = Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Shortcut for getElementById (non-null asserted — caller knows the id exists). */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Create an element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: Child[],
): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Attrs, children?: Child[]): HTMLElement;
export function h(tag: string, attrs: Attrs = {}, children: Child[] = []): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = String(value);
    else if (key === "dataset") Object.assign(el.dataset, value as Record<string, string>);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value as Partial<CSSStyleDeclaration>);
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else el.setAttribute(key, value === true ? "" : String(value));
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el: HTMLElement, children: Child | Child[]): void {
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) {
      appendChildren(el, c);
    } else if (typeof c === "string" || typeof c === "number") {
      el.appendChild(document.createTextNode(String(c)));
    } else {
      el.appendChild(c);
    }
  }
}

/** Debounce a function. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 100): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
  wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  return wrapped;
}

/** Schedule a callback during idle time. */
export function idle(callback: () => void, timeout = 1200): void {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 150);
  }
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Format a page id with leading zeros.
 * 支持带前缀（如 "A1" / "C0023"）的页码：仅对数字部分补零，
 * 与 navigation.normalizePageId 的语义保持一致。
 */
export function padPage(page: string | number, width = 4): string {
  const s = String(page);
  const m = s.match(/^(\D*)(\d+)$/);
  if (m) return m[1] + m[2].padStart(width, "0");
  return s.padStart(width, "0");
}

/** Escape a string for safe insertion into HTML text. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip leading zeros from a numeric page id (keeps A/C prefix intact,
 * also strips zeros after the prefix so "A0001" → "A1").
 */
export function stripPage(p: string): string {
  const s = String(p);
  const m = s.match(/^(\D*)0+(\d+)$/);
  if (m) return m[1] + m[2];
  return s.replace(/^0+/, "") || s;
}
