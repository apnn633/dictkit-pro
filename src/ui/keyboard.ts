// ============================================================
// ui/keyboard.ts — 全局键盘快捷键
// ============================================================
import { byId } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import { isContentPage, shiftPage } from "../core/navigation.ts";
import * as store from "../utils/store.ts";

// viewer 通过动态 import 加载以打破循环依赖（viewer → url-sync → thumbnails → viewer）
// 使用字面量路径，Vite 可静态分析并正确 code-split
type ViewerApi = typeof import("../viewer/viewer.ts");

let viewerMod: ViewerApi | null = null;

/** 懒加载并缓存 viewer 模块。 */
async function viewer(): Promise<ViewerApi> {
  if (!viewerMod) viewerMod = await import("../viewer/viewer.ts");
  return viewerMod;
}

/** 当前活动元素是否处于可编辑状态。 */
function isEditable(el: EventTarget | null): boolean {
  // L2：仅屏蔽可编辑文本类控件，避免过度屏蔽 checkbox/radio/button 等
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return ["text", "search", "url", "password", "number"].includes(el.type);
  }
  return false;
}

/** 关闭所有浮层与侧栏。 */
export function closeAllOverlays(): void {
  byId("pinyinPopup")?.classList.remove("active");
  for (const id of ["historyPanel", "bookmarkPanel", "notesPanel", "sidebarPopup"]) {
    byId(id)?.classList.remove("active");
  }
  const settings = byId("settingsPanel");
  const settingsToggle = byId("settingsToggle");
  settings?.classList.remove("active");
  settingsToggle?.setAttribute("aria-expanded", "false");
  byId("thumbnailBar")?.classList.remove("expanded");
  byId("comparePicker")?.remove();
  document.body.style.overflow = "";
}

/**
 * 键盘切换双页模式。
 * - M1：开启时若处于 >1 的奇数内容页，应向前退一格到偶数页（形成偶-奇对开），
 *   原先 +1 会跳到下一个奇数页导致对开错位。
 * - M2：切换后写入持久化键，与设置面板的下拉变更共用同一键名 "spreadMode"。
 */
// L10：异步切换期间的重入闸门，避免连按 D 导致状态错乱
let toggling = false;
async function toggleSpreadViaKeyboard(): Promise<void> {
  if (toggling) return;
  toggling = true;
  try {
    state.isSpreadMode = !state.isSpreadMode;
    if (state.isSpreadMode) {
      const page = state.currentPage;
      if (isContentPage(page)) {
        const num = parseInt(page, 10);
        if (num > 1 && num % 2 === 1) {
          setCurrentPage(shiftPage(page, -1, state.currentDict));
        }
      }
    }
    store.set("spreadMode", state.isSpreadMode);
    const v = await viewer();
    await v.showImage();
    // 同步设置面板中的版式下拉
    const sel = byId<HTMLSelectElement>("spreadModeSelect");
    if (sel) sel.value = state.isSpreadMode ? "1" : "0";
  } finally {
    toggling = false;
  }
}

/** 初始化全局键盘快捷键。 */
export function initKeyboardShortcuts(): void {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    const el = document.activeElement;

    // 可编辑元素中：仅允许 Escape 失焦
    if (isEditable(el)) {
      if (e.key === "Escape") (el as HTMLElement).blur();
      return;
    }
    // SELECT 聚焦时除 Escape 外不处理
    if (el instanceof HTMLSelectElement && e.key !== "Escape") return;

    const meta = e.ctrlKey || e.metaKey;
    // 带修饰键的组合（除 Escape）保留给浏览器
    if (meta && e.key !== "Escape") return;
    // L1：方向导航键带 Shift/Alt 时保留给浏览器（文本选择、Alt+方向后退等）
    if ((e.shiftKey || e.altKey) && ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) return;

    // 用分发模式让每个分支各自负责 preventDefault 与异步错误处理（M16）。
    // 异步分支统一 .catch 到 console.warn，避免 unhandledrejection。
    const run = (fn: () => Promise<unknown>): void => {
      e.preventDefault();
      fn().catch(err => console.warn("keyboard shortcut failed:", err));
    };

    switch (e.key) {
      case "ArrowLeft":
        run(async () => (await viewer()).changeImage(false));
        break;
      case "ArrowRight":
        run(async () => (await viewer()).changeImage(true));
        break;
      case "Home":
        run(async () => (await viewer()).gotoFirst());
        break;
      case "End":
        run(async () => (await viewer()).gotoLast());
        break;
      case "PageUp":
        run(async () => (await viewer()).jumpBy(-10));
        break;
      case "PageDown":
        run(async () => (await viewer()).jumpBy(10));
        break;
      case "+":
      case "=":
        run(async () => (await viewer()).adjustZoom(20));
        break;
      case "-":
        run(async () => (await viewer()).adjustZoom(-20));
        break;
      case "0":
        run(async () => (await viewer()).resetZoom());
        break;
      case "r":
      case "R":
        run(async () => (await viewer()).rotate());
        break;
      case "f":
      case "F":
        run(async () => (await viewer()).toggleFullscreen());
        break;
      case "d":
      case "D":
        run(() => toggleSpreadViaKeyboard());
        break;
      case "Escape":
        closeAllOverlays();
        break;
      default:
        break;
    }
  });
}
