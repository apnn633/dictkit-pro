// ============================================================
// ui/bookmarks.ts — 书签收藏侧栏
// ============================================================
import { byId, h, stripPage } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import * as store from "../utils/store.ts";
import { downloadText } from "../utils/url.ts";
import type { Bookmark } from "../types/state.ts";
import { toast } from "./toast.ts";
import { closeAllRightSidebars } from "./history.ts";
import { t } from "./i18n.ts";

// main.ts 通过字面量动态 import 加载以打破 main ↔ ui 的循环依赖，
// Vite 仍能静态分析路径进行 code-split。

const KEY = "bookmarks";

/** 读取全部书签。 */
export function getBookmarks(): Bookmark[] {
  return store.get<Bookmark[]>(KEY, []);
}

/** 当前页是否已收藏。 */
export function isCurrentPageBookmarked(): boolean {
  const dict = state.currentDict;
  if (!dict) return false;
  return getBookmarks().some(b => b.dict === dict && b.page === state.currentPage);
}

/** 收藏当前页（已存在则提示，超限裁剪）。 */
export async function addCurrentBookmark(note?: string): Promise<void> {
  const dict = state.currentDict;
  if (!dict) return;
  const page = state.currentPage;
  const list = getBookmarks();
  if (list.some(b => b.dict === dict && b.page === page)) {
    toast(t("bookmarked"), "info");
    return;
  }
  list.unshift({ dict, page, note: note ?? "", ts: Date.now() });
  const limit = state.defaults.bookmarkLimit || 200;
  if (list.length > limit) list.length = limit;
  store.set(KEY, list);
  toast(t("bookmarkAdded"), "success");
  renderBookmarks();
}

/** 删除指定书签。 */
export function removeBookmark(dict: string, page: string): void {
  const list = getBookmarks().filter(b => !(b.dict === dict && b.page === page));
  store.set(KEY, list);
  renderBookmarks();
}

/** 渲染书签列表。 */
export function renderBookmarks(): void {
  const list = byId("bookmarkList");
  if (!list) return;
  const items = getBookmarks();
  list.innerHTML = "";
  if (!items.length) {
    list.appendChild(h("div", { class: "empty-state" }, [t("noBookmarks")]));
    return;
  }
  for (const b of items) {
    const dictName = state.dicts[b.dict]?.name || b.dict;
    const label = b.note || t("pageN", stripPage(b.page));
    const item = h("div", { class: "bookmark-item" }, [
      h("span", { class: "bookmark-term" }, [label]),
      h("span", { class: "bookmark-meta" }, [`${dictName} · ${b.page}`]),
      h("button", { class: "text-btn bookmark-delete", title: t("delete"), "aria-label": t("deleteBookmark") }, ["×"]),
    ]);
    // 点击条目 → 跳转
    item.addEventListener("click", () => {
      void openBookmark(b).catch(err => console.warn("openBookmark failed:", err));
    });
    // 删除按钮：阻止冒泡，避免触发跳转
    const del = item.querySelector<HTMLElement>(".bookmark-delete");
    del?.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      removeBookmark(b.dict, b.page);
    });
    list.appendChild(item);
  }
}

/** 打开书签：跨词典时走完整切换流程，再加载图片。 */
async function openBookmark(b: Bookmark): Promise<void> {
  if (b.dict && b.dict !== state.currentDict) {
    const { switchToDict } = await import("../main.ts");
    await switchToDict(b.dict);
  }
  setCurrentPage(b.page);
  closeAllRightSidebars();
  // viewer 通过字面量动态 import 加载以避免循环依赖，且让 Vite 能静态分析
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
}

/** 初始化书签侧栏按钮。 */
export function initBookmarks(): void {
  byId("bookmarkToggle")?.addEventListener("click", () => {
    closeAllRightSidebars();
    byId("bookmarkPanel")?.classList.add("active");
    renderBookmarks();
  });
  byId("closeBookmark")?.addEventListener("click", closeAllRightSidebars);
  byId("addBookmark")?.addEventListener("click", () => {
    void addCurrentBookmark().catch(err => console.warn("addCurrentBookmark failed:", err));
  });
  byId("exportBookmarks")?.addEventListener("click", () => {
    downloadText("bookmarks.json", JSON.stringify(getBookmarks(), null, 2));
  });
}
