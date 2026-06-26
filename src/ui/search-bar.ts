// ============================================================
// ui/search-bar.ts — 搜索输入、建议下拉与过滤筹码
// ============================================================
import { byId, h, debounce } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import { isNumeric } from "../core/navigation.ts";
import { searchDictionary, resolveNumericPage } from "../search/engine.ts";
import { highlightTerm } from "../search/highlight.ts";
import type { SearchFilter } from "../types/search.ts";
import { recordHistory } from "./history.ts";
import { t, searchTypeLabel } from "./i18n.ts";

// viewer 通过动态 import 加载以打破循环依赖（字面量路径，Vite 可静态分析）
const SUGGESTION_LIMIT = 12;
const SUGGESTION_DEBOUNCE = 100;

/** 外部注册的搜索回调（每次有效搜索时触发）。 */
let searchCallback: ((query: string) => void) | null = null;

/** 注册搜索回调。 */
export function onSearch(cb: (query: string) => void): void {
  searchCallback = cb;
}

/** 清空搜索框并隐藏建议下拉。 */
export function clearSearchInput(): void {
  const input = byId<HTMLInputElement>("searchInput");
  if (input) input.value = "";
  hideSuggestions();
}

/** 设置搜索结果状态栏文本。 */
function setStatus(message: string): void {
  const el = byId("searchResult");
  if (el) el.textContent = message;
}

/** 隐藏搜索建议下拉并清空内容。 */
function hideSuggestions(): void {
  const box = byId("searchSuggestions");
  if (box) {
    box.classList.remove("visible");
    box.innerHTML = "";
  }
  state.highlightedIndex = -1;
}

/** 跳转到指定页码：设置当前页、加载图片、记录历史。 */
async function jumpToPage(page: string, query?: string, term?: string): Promise<void> {
  const repo = state.currentDict;
  if (!repo) return;
  setCurrentPage(page);
  hideSuggestions();
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
  recordHistory({ dict: repo, page, query, term });
}

/** 执行搜索（点击按钮或回车触发）。 */
async function runSearch(): Promise<void> {
  const input = byId<HTMLInputElement>("searchInput");
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  searchCallback?.(query);
  hideSuggestions();

  // 纯数字 → 直接翻页
  if (isNumeric(query)) {
    const page = resolveNumericPage(query);
    if (page) {
      await jumpToPage(page, query);
    } else {
      setStatus(t("noResults"));
    }
    return;
  }

  const results = searchDictionary(query);
  if (!results.length) {
    setStatus(t("noResults"));
    return;
  }
  setStatus("");
  const first = results[0];
  await jumpToPage(first.page, query, first.term);
}

/** 渲染搜索建议下拉（最多 SUGGESTION_LIMIT 条）。 */
function showSuggestions(query: string): void {
  const q = query.trim();
  const box = byId("searchSuggestions");
  if (!box) return;
  if (!q || isNumeric(q)) {
    hideSuggestions();
    return;
  }
  const results = searchDictionary(q, { limit: SUGGESTION_LIMIT });
  box.innerHTML = "";
  if (!results.length) {
    hideSuggestions();
    return;
  }
  state.highlightedIndex = -1;

  for (const r of results) {
    const term = h("span", { class: "suggestion-term" });
    term.innerHTML = highlightTerm(r.term, q);
    // M10：分类标签走 i18n（按 r.key 翻译），不再透传原始 type 字符串
    const meta = h("span", { class: "suggestion-type" }, [`${searchTypeLabel(r.key)} · ${r.page}`]);
    const item = h("div", { class: "suggestion-item", role: "option", tabindex: "-1" }, [term, meta]);
    item.addEventListener("click", () => {
      // M16：跳转异步错误归并到 console.warn，避免 unhandledrejection
      void jumpToPage(r.page, q, r.term).catch(err => console.warn("jumpToPage failed:", err));
    });
    box.appendChild(item);
  }
  box.classList.add("visible");
}

/** 取得当前下拉中的建议项。 */
function getSuggestionItems(): HTMLElement[] {
  const box = byId("searchSuggestions");
  if (!box) return [];
  return Array.from(box.querySelectorAll<HTMLElement>(".suggestion-item"));
}

/** 键盘上下键循环高亮建议项。 */
function highlightSuggestion(delta: number): void {
  const items = getSuggestionItems();
  if (!items.length) return;
  const len = items.length;
  const idx = (state.highlightedIndex + delta + len) % len;
  state.highlightedIndex = idx;
  items.forEach((el, i) => el.classList.toggle("highlighted", i === idx));
  items[idx]?.scrollIntoView({ block: "nearest" });
}

/** 初始化搜索栏：按钮、键盘、输入防抖、过滤筹码。 */
export function initSearchBar(): void {
  const input = byId<HTMLInputElement>("searchInput");
  const btn = byId("searchBtn");
  const filter = byId("searchFilter");

  // M16：所有异步分支统一 .catch，避免未处理 rejection
  btn?.addEventListener("click", () => void runSearch().catch(err => console.warn("runSearch failed:", err)));

  if (input) {
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (state.highlightedIndex >= 0) {
          const items = getSuggestionItems();
          items[state.highlightedIndex]?.click();
        } else {
          void runSearch().catch(err => console.warn("runSearch failed:", err));
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        highlightSuggestion(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlightSuggestion(-1);
      } else if (e.key === "Escape") {
        hideSuggestions();
        input.blur();
      }
    });

    const schedule = debounce(() => showSuggestions(input.value), SUGGESTION_DEBOUNCE);
    input.addEventListener("input", schedule);
  }

  // 过滤筹码：切换 active 并写入全局 searchFilter
  if (filter) {
    filter.addEventListener("click", (e: MouseEvent) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>(".filter-chip");
      if (!chip) return;
      const value = chip.dataset.filter as SearchFilter | undefined;
      if (!value) return;
      filter.querySelectorAll<HTMLElement>(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.searchFilter = value;
    });
  }
}
