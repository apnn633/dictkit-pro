// ============================================================
// ui/url-sync.ts — URL 参数与状态同步
// ============================================================
import { byId } from "../utils/dom.ts";
import { state } from "../core/state.ts";
import { updateURLParams } from "../utils/url.ts";
import { saveLastPosition } from "./sidebar.ts";
import { highlightActiveThumb } from "./thumbnails.ts";

let initialized = false;
/** 上次同步时的页码，用于判断是否需要 pushState 产生新历史条目。 */
let lastSyncedPage = "";
/** popstate 期间抑制 sync 的 pushState，避免污染历史栈。 */
let suppressPush = false;

interface DictkitWindow {
  __dictkitSyncURL?: () => void;
}

/** 将当前状态写入 URL，并同步阅读位置与缩略图高亮。 */
function sync(): void {
  const input = byId<HTMLInputElement>("searchInput");
  const params: Record<string, string | null | undefined> = {
    dict: state.currentDict ?? "",
    query: input?.value.trim() ?? "",
    page: state.currentPage,
  };
  // updateURLParams 内部使用 replaceState（仅修正当前条目）。
  updateURLParams(params);
  // H6：页码变化时补一次 pushState，使浏览器前进/后退可在页间切换。
  // popstate 期间（由 initFromURL 触发的回写）不推送，避免递归污染历史栈。
  if (!suppressPush && state.currentPage !== lastSyncedPage) {
    history.pushState({}, "", location.href);
  }
  lastSyncedPage = state.currentPage;
  saveLastPosition();
  highlightActiveThumb();
}

/** 初始化 URL 同步：注册全局回调、监听 popstate 并执行一次。 */
export function initUrlSync(): void {
  if (initialized) return;
  initialized = true;
  (window as unknown as DictkitWindow).__dictkitSyncURL = sync;
  // 记录初始页码，避免首次 sync 产生多余的 pushState
  lastSyncedPage = state.currentPage;
  // H6：监听 popstate，后退/前进时从 URL 重新读取状态并刷新。
  // 用动态 import 调用 main.ts 的 initFromURL，避免静态导入循环依赖。
  window.addEventListener("popstate", () => {
    suppressPush = true;
    void import("../main.ts")
      .then(m => m.initFromURL())
      .catch(err => console.warn("popstate initFromURL failed:", err))
      .finally(() => { suppressPush = false; });
  });
  sync();
}

/** 触发一次 URL 同步（若已初始化）。 */
export function syncURL(): void {
  const w = window as unknown as DictkitWindow;
  if (typeof w.__dictkitSyncURL === "function") w.__dictkitSyncURL();
}
