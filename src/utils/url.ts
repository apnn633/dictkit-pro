// ============================================================
// utils/url.ts — URL / page helpers
// ============================================================
import { stripPage } from "./dom.ts";

/** Read query params into a plain object. */
export function getURLParams(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

/** Replace current URL with new params (no history entry). */
export function updateURLParams(params: Record<string, string | null | undefined>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState({}, "", url);
}

/** Strip leading zeros from a numeric page id (keeps A/C prefix intact). */
export function stripLeadingZeros(page: string | number): string {
  // M11：复用 dom.ts 的 stripPage，避免重复实现
  return stripPage(String(page));
}

/** Trigger a client-side download of a text file. */
export function downloadText(filename: string, content: string, mime = "application/json"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // M12：延迟 revoke，避免浏览器尚未完成下载就释放 blob URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
