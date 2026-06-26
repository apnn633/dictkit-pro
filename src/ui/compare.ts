// ============================================================
// ui/compare.ts — 词典对照模式
// ============================================================
import { byId, h } from "../utils/dom.ts";
import { state } from "../core/state.ts";
import { toast } from "./toast.ts";
import { t } from "./i18n.ts";

let initialized = false;
// L9：对照选择弹层的 ESC 监听引用，关闭时一并移除避免泄漏
let activeEscHandler: ((e: KeyboardEvent) => void) | null = null;

/** 退出对照模式。 */
async function exitCompare(): Promise<void> {
  state.compareMode = false;
  state.compareDict = null;
  byId("resultContainer")?.classList.remove("compare-mode");
  // L10：同步按钮 aria-pressed 状态
  byId("compareToggle")?.setAttribute("aria-pressed", "false");
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
  toast(t("exitCompare"), "info");
}

/** 开启与指定词典的对照。失败时回滚状态并提示。 */
async function startCompare(repo: string): Promise<void> {
  state.compareDict = repo;
  state.compareMode = true;
  byId("resultContainer")?.classList.add("compare-mode");
  try {
    const mod = await import("../viewer/viewer.ts");
    await mod.showImage();
    toast(t("enterCompare"), "success");
    // L10：成功后同步按钮 aria-pressed 状态
    byId("compareToggle")?.setAttribute("aria-pressed", "true");
  } catch (err) {
    // M8：失败回滚，避免停留在残缺的对照态
    state.compareMode = false;
    state.compareDict = null;
    byId("resultContainer")?.classList.remove("compare-mode");
    toast(t("loadFailed"), "error");
    throw err;
  }
}

/** 关闭选择弹层。 */
function closePicker(overlay: HTMLElement): void {
  overlay.classList.remove("active");
  setTimeout(() => overlay.remove(), 200);
  // L9：一并移除 ESC 监听，避免泄漏
  if (activeEscHandler) {
    document.removeEventListener("keydown", activeEscHandler);
    activeEscHandler = null;
  }
}

/** 打开对照词典选择弹层。 */
function openComparePicker(): void {
  byId("comparePicker")?.remove();
  // L9：清理可能残留的旧 ESC 监听（重入场景）
  if (activeEscHandler) {
    document.removeEventListener("keydown", activeEscHandler);
    activeEscHandler = null;
  }

  const current = state.currentDict;
  const others = Object.values(state.dicts).filter(d => d.repo !== current);
  if (!others.length) {
    toast(t("noCompareDict"), "warn");
    return;
  }

  const list = h("div", { class: "compare-list" }, others.map(d => {
    const img = h("img", { class: "dict-logo-sm", src: d.logo, alt: d.name });
    // M20：logo 缺失时回退到通用 logo，避免破图
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      img.src = "assets/logos/logo2.png";
    });
    return h("button", { class: "compare-option", dataset: { repo: d.repo } }, [
      img,
      h("span", { class: "compare-name" }, [d.name]),
    ]);
  }));

  const content = h("div", { class: "popup-content" }, [
    h("div", { class: "popup-header" }, [
      h("h3", {}, [t("pickCompare")]),
      h("button", { class: "close-popup", "aria-label": t("close") }, ["×"]),
    ]),
    list,
  ]);

  const overlay = h("div", { class: "popup-overlay", id: "comparePicker" }, [content]);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("active"));

  // 点击背景或关闭按钮 → 关闭
  overlay.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === overlay || target.classList.contains("close-popup")) {
      closePicker(overlay);
    }
  });

  // L9：ESC 关闭对照选择弹层（closePicker 内会移除本监听）
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closePicker(overlay);
  };
  activeEscHandler = escHandler;
  document.addEventListener("keydown", escHandler);

  // 选择某个词典 → 开启对照并关闭弹层
  list.querySelectorAll<HTMLElement>(".compare-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const repo = btn.dataset.repo;
      if (repo) void startCompare(repo).catch(err => console.warn("startCompare failed:", err));
      closePicker(overlay);
    });
  });
}

/** 初始化对照模式开关。 */
export function initCompare(): void {
  if (initialized) return;
  initialized = true;
  byId("compareToggle")?.addEventListener("click", () => {
    if (state.compareMode) {
      void exitCompare().catch(err => console.warn("exitCompare failed:", err));
    } else {
      openComparePicker();
    }
  });
}
