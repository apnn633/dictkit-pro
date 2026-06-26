// ============================================================
// ui/url-sync.ts — URL 参数与状态同步
// ============================================================
import { byId } from "../utils/dom.ts";
import { state } from "../core/state.ts";
import { updateURLParams } from "../utils/url.ts";
import { saveLastPosition } from "./sidebar.ts";
import { highlightActiveThumb } from "./thumbnails.ts";

let initialized = false;

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
  updateURLParams(params);
  saveLastPosition();
  highlightActiveThumb();
}

/** 初始化 URL 同步：注册全局回调并执行一次。 */
export function initUrlSync(): void {
  if (initialized) return;
  initialized = true;
  (window as unknown as DictkitWindow).__dictkitSyncURL = sync;
  sync();
}

/** 触发一次 URL 同步（若已初始化）。 */
export function syncURL(): void {
  const w = window as unknown as DictkitWindow;
  if (typeof w.__dictkitSyncURL === "function") w.__dictkitSyncURL();
}
