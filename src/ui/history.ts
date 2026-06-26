// ============================================================
// ui/history.ts — 阅读历史侧栏
// ============================================================
import { byId, h, stripPage } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import * as store from "../utils/store.ts";
import { downloadText } from "../utils/url.ts";
import type { HistoryEntry } from "../types/state.ts";
import { toast } from "./toast.ts";
import { t, getCurrentLang } from "./i18n.ts";

const KEY = "history";

/** 格式化时间戳为简短字符串（M11：locale 跟随当前语言）。 */
function formatTime(ts: number): string {
  try {
    const locale = getCurrentLang() === "en" ? "en-US" : "zh-CN";
    return new Date(ts).toLocaleString(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** 记录一条阅读历史（连续同字典同页去重，超限裁剪）。 */
export function recordHistory(entry: {
  dict: string;
  page: string;
  query?: string;
  term?: string;
}): void {
  const list = getHistory();
  const now = Date.now();
  const head = list[0];
  if (head && head.dict === entry.dict && head.page === entry.page) {
    // 连续同字典同页：仅刷新时间与查询词
    head.ts = now;
    if (entry.query !== undefined) head.query = entry.query;
    if (entry.term !== undefined) head.term = entry.term;
  } else {
    const item: HistoryEntry = {
      dict: entry.dict,
      page: entry.page,
      query: entry.query,
      term: entry.term,
      ts: now,
    };
    list.unshift(item);
  }
  const limit = state.defaults.historyLimit || 100;
  if (list.length > limit) list.length = limit;
  store.set(KEY, list);
}

/** 读取全部阅读历史。 */
export function getHistory(): HistoryEntry[] {
  return store.get<HistoryEntry[]>(KEY, []);
}

/** 清空阅读历史。 */
export function clearHistory(): void {
  store.set(KEY, []);
  renderHistory();
  toast(t("historyCleared"), "success");
}

/** 渲染阅读历史列表。 */
export function renderHistory(): void {
  const list = byId("historyList");
  if (!list) return;
  const items = getHistory();
  list.innerHTML = "";
  if (!items.length) {
    list.appendChild(h("div", { class: "empty-state" }, [t("noHistory")]));
    return;
  }
  for (const it of items) {
    const dictName = state.dicts[it.dict]?.name || it.dict;
    const label = it.term || it.query || `第 ${stripPage(it.page)} 页`;
    const meta = `${dictName} · 第 ${stripPage(it.page)} 页 · ${formatTime(it.ts)}`;
    const item = h("div", { class: "bookmark-item" }, [
      h("span", { class: "history-term" }, [label]),
      h("span", { class: "history-meta" }, [meta]),
    ]);
    item.addEventListener("click", () => {
      void openHistory(it).catch(err => console.warn("openHistory failed:", err));
    });
    list.appendChild(item);
  }
}

/** 打开历史条目：跨词典时走完整切换流程，再加载图片。 */
async function openHistory(it: HistoryEntry): Promise<void> {
  if (it.dict && it.dict !== state.currentDict) {
    const { switchToDict } = await import("../main.ts");
    await switchToDict(it.dict);
  }
  setCurrentPage(it.page);
  closeAllRightSidebars();
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
}

/** 关闭所有右侧侧栏。 */
export function closeAllRightSidebars(): void {
  for (const id of ["historyPanel", "bookmarkPanel", "notesPanel"]) {
    byId(id)?.classList.remove("active");
  }
}

/** 初始化历史侧栏按钮。 */
export function initHistory(): void {
  byId("historyToggle")?.addEventListener("click", () => {
    closeAllRightSidebars();
    byId("historyPanel")?.classList.add("active");
    renderHistory();
  });
  byId("closeHistory")?.addEventListener("click", closeAllRightSidebars);
  byId("clearHistory")?.addEventListener("click", clearHistory);
  byId("exportHistory")?.addEventListener("click", () => {
    downloadText("history.json", JSON.stringify(getHistory(), null, 2));
  });
  // 语言切换时若面板正打开，重渲染以同步空态文案
  window.addEventListener("dictkit:langchange", () => {
    if (byId("historyPanel")?.classList.contains("active")) renderHistory();
  });
}
