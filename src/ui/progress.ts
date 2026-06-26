// ============================================================
// ui/progress.ts — 阅读进度条
// ============================================================
import { byId } from "../utils/dom.ts";
import { state } from "../core/state.ts";
import { pageConfig } from "../core/config.ts";
import { totalPages } from "../core/navigation.ts";

/** 进度条已在 HTML 中，无需额外初始化。 */
export function initProgress(): void {
  // no-op
}

/** 依据当前页计算并更新进度条宽度。 */
export function updateProgress(): void {
  const bar = byId("readingProgressBar");
  if (!bar) return;

  const cfg = pageConfig(state.currentDict);
  const total = totalPages(state.currentDict);
  if (total <= 0) {
    bar.style.width = "0%";
    return;
  }

  const page = state.currentPage;
  let index: number;
  if (cfg.header.count && cfg.header.prefix && page.startsWith(cfg.header.prefix)) {
    index = parseInt(page.slice(cfg.header.prefix.length), 10) - 1;
  } else if (cfg.footer.count && cfg.footer.prefix && page.startsWith(cfg.footer.prefix)) {
    index = cfg.header.count + cfg.content.count + parseInt(page.slice(cfg.footer.prefix.length), 10) - 1;
  } else {
    index = cfg.header.count + parseInt(page, 10) - 1;
  }
  if (Number.isNaN(index) || index < 0) index = 0;

  const pct = Math.min(100, Math.max(0, ((index + 1) / total) * 100));
  bar.style.width = `${pct}%`;
}
