// ============================================================
// ui/sidebar.ts — 词典目录（TOC）侧栏 + 阅读位置记忆
// ============================================================
import { byId, h, stripPage } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import * as store from "../utils/store.ts";
import { t } from "./i18n.ts";

const KEY = "lastPage";

/** 目录叶子节点。 */
type TocLeaf = { title: string; page: string };
/** 目录节点（带 more 时为可折叠分组）。 */
type TocItem = { title: string; page: string; more?: Array<{ title: string; page: string }> };

/** 构建词典目录侧栏。 */
export async function setupSidebar(): Promise<void> {
  const container = byId("bookmarksList");
  if (!container) return;
  container.innerHTML = "";

  const repo = state.currentDict;
  if (!repo) return;
  const dict = state.dicts[repo];
  if (!dict) return;

  // 目录结构较为宽松，统一断言为 TocItem[]
  const toc = (dict.toc as TocItem[] | null) || [];
  if (!toc.length) {
    container.appendChild(h("div", { class: "empty-state" }, [t("noToc")]));
    return;
  }
  for (const item of toc) {
    container.appendChild(buildTocNode(item));
  }
}

/** 构建单个目录节点：含 more 则为折叠分组，否则为叶子。 */
function buildTocNode(item: TocItem): HTMLElement {
  if (item.more && item.more.length) {
    const group = h("div", { class: "bookmark-group" }, [
      h("div", { class: "bookmark-group-header" }, [
        h("span", { class: "toc-title" }, [item.title]),
        h("span", { class: "group-arrow" }, ["▶"]),
      ]),
      h("div", { class: "bookmark-group-content" }, item.more.map(child => buildTocLeaf(child))),
    ]);
    const header = group.querySelector<HTMLElement>(".bookmark-group-header");
    header?.addEventListener("click", () => {
      group.classList.toggle("expanded");
    });
    return group;
  }
  return buildTocLeaf(item);
}

/** 构建叶子目录项。 */
function buildTocLeaf(item: TocLeaf): HTMLElement {
  const leaf = h("div", { class: "bookmark-item" }, [
    h("span", { class: "toc-title" }, [item.title]),
    h("span", { class: "page-number" }, [stripPage(item.page)]),
  ]);
  leaf.addEventListener("click", () => {
    void openTocPage(item.page).catch(err => console.warn("openTocPage failed:", err));
  });
  return leaf;
}

/** 跳转到目录页。 */
async function openTocPage(page: string): Promise<void> {
  setCurrentPage(page);
  closeSidebar();
  // viewer 通过字面量动态 import 加载以避免循环依赖，且让 Vite 能静态分析
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
}

/** 关闭目录侧栏并收起所有分组。 */
export function closeSidebar(): void {
  byId("sidebarPopup")?.classList.remove("active");
  document.body.style.overflow = "";
  byId("bookmarksList")
    ?.querySelectorAll<HTMLElement>(".bookmark-group.expanded")
    .forEach(g => g.classList.remove("expanded"));
}

/** 初始化目录侧栏开关。 */
export function initSidebarToggle(): void {
  byId("sidebarToggle")?.addEventListener("click", () => {
    const popup = byId("sidebarPopup");
    if (!popup) return;
    const willOpen = !popup.classList.contains("active");
    popup.classList.toggle("active");
    document.body.style.overflow = willOpen ? "hidden" : "";
    if (willOpen) void setupSidebar().catch(err => console.warn("setupSidebar failed:", err));
  });
  byId("closeSidebarPopup")?.addEventListener("click", closeSidebar);
}

/** 保存当前词典的最后阅读位置。 */
export function saveLastPosition(): void {
  const repo = state.currentDict;
  if (!repo) return;
  const all = store.get<Record<string, { page: string; ts: number }>>(KEY, {});
  all[repo] = { page: state.currentPage, ts: Date.now() };
  store.set(KEY, all);
}

/** 读取某词典的最后阅读位置（无则 null）。 */
export function getLastPosition(repo: string): string | null {
  const all = store.get<Record<string, { page: string; ts: number }>>(KEY, {});
  return all[repo]?.page ?? null;
}
