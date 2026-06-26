// ============================================================
// ui/notes.ts — 批注笔记（按页）
// ============================================================
import { byId, h, stripPage } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import * as store from "../utils/store.ts";
import { downloadText } from "../utils/url.ts";
import type { Note } from "../types/state.ts";
import { toast } from "./toast.ts";
import { closeAllRightSidebars } from "./history.ts";
import { t, getCurrentLang } from "./i18n.ts";

const KEY = "notes";

// M9：笔记文本长度上限与条数上限，防止本地存储膨胀
const MAX_NOTE_LENGTH = 5000;
const MAX_NOTES = 500;

let initialized = false;

// L6：自定义弹层重入时旧 Promise 永不 resolve；记录挂起的 close 以便先触发它
let activePromptClose: (() => void) | null = null;

// 探测结果缓存：null=未探测, true=原生可用, false=需回退
// 不在初始化做"空探测"（会向用户弹空框），而是在首次真实调用时 try/catch：
// 常规环境首次即真实调用，成功后缓存 true；沙箱环境首次抛错，缓存 false 后续直接回退。
let nativePromptAvailable: boolean | null = null;

/**
 * 输入笔记文本。优先使用原生 window.prompt；当环境禁用 prompt
 * （如部分沙箱/iframe）时回退到自定义弹层。返回用户输入原文，
 * 取消/关闭返回 null。
 */
function promptNote(title: string, initial = ""): Promise<string | null> {
  // 已确认原生不可用 → 直接回退
  if (nativePromptAvailable === false) {
    return customPromptDialog(title, initial);
  }
  // 未探测或已确认可用 → 尝试原生（首次调用即探测）
  if (typeof window.prompt === "function") {
    try {
      const result = window.prompt(title, initial);
      nativePromptAvailable = true;
      return Promise.resolve(result);
    } catch {
      // 抛错说明环境禁用，缓存并回退
      nativePromptAvailable = false;
    }
  } else {
    nativePromptAvailable = false;
  }
  return customPromptDialog(title, initial);
}

/** 自定义弹层回退实现（window.prompt 不可用时使用）。 */
function customPromptDialog(title: string, initial = ""): Promise<string | null> {
  return new Promise(resolve => {
    // L6：防重入——若有挂起的旧弹层，先触发其 close 让旧 Promise resolve(null)，避免永不 resolve
    activePromptClose?.();
    // 防重入：若已有弹层则先移除
    byId("notePrompt")?.remove();
    const overlay = h("div", { class: "popup-overlay", id: "notePrompt" }, [
      h("div", { class: "popup-content" }, [
        h("div", { class: "popup-header" }, [
          h("h3", {}, [title]),
          h("button", { class: "close-popup", "aria-label": t("close") }, ["×"]),
        ]),
        h("div", { class: "note-prompt-body" }, [
          h("textarea", { class: "note-prompt-input", rows: "4" }, [initial]),
          h("div", { class: "note-prompt-actions" }, [
            h("button", { class: "text-btn note-prompt-cancel" }, [t("cancel")]),
            h("button", { class: "text-btn note-prompt-confirm" }, [t("confirm")]),
          ]),
        ]),
      ]),
    ]);
    document.body.appendChild(overlay);

    // M15：显式 null 检查替代非空断言；找不到时直接关闭弹层返回 null。
    const ta = overlay.querySelector<HTMLTextAreaElement>(".note-prompt-input");
    const close = (result: string | null) => {
      // L6：关闭后清空挂起标记，避免后续新弹层误触发已 resolve 的旧 close
      activePromptClose = null;
      overlay.classList.remove("active");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };
    // L6：登记当前 close（包装为 0 参函数以匹配类型），供重入时先触发并 resolve(null)
    activePromptClose = () => close(null);
    if (!ta) {
      close(null);
      return;
    }

    overlay.querySelector(".close-popup")?.addEventListener("click", () => close(null));
    overlay.querySelector(".note-prompt-cancel")?.addEventListener("click", () => close(null));
    overlay.querySelector(".note-prompt-confirm")?.addEventListener("click", () => close(ta.value));
    // 点击背景关闭
    overlay.addEventListener("click", (e: MouseEvent) => {
      if (e.target === overlay) close(null);
    });
    // Ctrl/Cmd+Enter 确认，Escape 取消
    ta.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close(ta.value); }
      else if (e.key === "Escape") { e.preventDefault(); close(null); }
    });

    // 显示后再聚焦，避免对 display:none 元素 focus 的行为差异
    requestAnimationFrame(() => {
      overlay.classList.add("active");
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  });
}

/** 生成唯一笔记 id。 */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 格式化时间戳（M11：locale 跟随当前语言）。 */
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

/** 读取全部笔记。 */
export function getNotes(): Note[] {
  return store.get<Note[]>(KEY, []);
}

/** 读取某词典某页的笔记。 */
export function getNotesForPage(dict: string, page: string): Note[] {
  return getNotes().filter(n => n.dict === dict && n.page === page);
}

/** 为当前页添加一条笔记。 */
export async function addNote(text: string): Promise<void> {
  const dict = state.currentDict;
  if (!dict) return;
  const page = state.currentPage;
  const now = Date.now();
  // M9：截断超长文本，避免单条笔记撑爆本地存储
  const trimmed = text.slice(0, MAX_NOTE_LENGTH);
  const note: Note = {
    id: genId(),
    dict,
    page,
    text: trimmed,
    ts: now,
    updatedAt: now,
  };
  const list = getNotes();
  list.unshift(note);
  // M9：条数上限，超出则丢弃最旧
  if (list.length > MAX_NOTES) list.length = MAX_NOTES;
  if (!store.set(KEY, list)) {
    toast(t("storeWriteFailed"), "warn");
    return;
  }
  toast(t("noteAdded"), "success");
  renderNotes();
}

/** 更新指定笔记的文本。 */
export function updateNote(id: string, text: string): void {
  const list = getNotes();
  const note = list.find(n => n.id === id);
  if (!note) return;
  note.text = text;
  note.updatedAt = Date.now();
  store.set(KEY, list);
  renderNotes();
}

/** 删除指定笔记。 */
export function deleteNote(id: string): void {
  const list = getNotes().filter(n => n.id !== id);
  store.set(KEY, list);
  toast(t("noteDeleted"), "info");
  renderNotes();
}

/** 渲染笔记列表。 */
export function renderNotes(): void {
  const list = byId("notesList");
  if (!list) return;
  const items = getNotes();
  list.innerHTML = "";
  if (!items.length) {
    list.appendChild(h("div", { class: "empty-state" }, [t("noNotes")]));
    return;
  }
  for (const n of items) {
    const dictName = state.dicts[n.dict]?.name || n.dict;
    const item = h("div", { class: "note-item", dataset: { id: n.id } }, [
      h("div", { class: "note-text" }, [n.text]),
      h("div", { class: "note-meta" }, [`${dictName} · ${t("pageN", stripPage(n.page))} · ${formatTime(n.updatedAt)}`]),
      h("div", { class: "note-actions" }, [
        h("button", { class: "text-btn note-edit" }, [t("noteEdit")]),
        h("button", { class: "text-btn note-delete" }, [t("noteDelete")]),
      ]),
    ]);
    // 点击条目 → 跳转到该页
    item.addEventListener("click", () => {
      void openNote(n).catch(err => console.warn("openNote failed:", err));
    });
    item.querySelector<HTMLElement>(".note-edit")?.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      void promptNote(t("noteEditPrompt"), n.text).then(next => {
        if (next !== null) updateNote(n.id, next);
      }).catch(err => console.warn("promptNote failed:", err));
    });
    item.querySelector<HTMLElement>(".note-delete")?.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      deleteNote(n.id);
    });
    list.appendChild(item);
  }
}

/** 打开笔记对应的页：跨词典时走完整切换流程，再加载图片。 */
async function openNote(n: Note): Promise<void> {
  if (n.dict && n.dict !== state.currentDict) {
    const { switchToDict } = await import("../main.ts");
    await switchToDict(n.dict);
  }
  setCurrentPage(n.page);
  closeAllRightSidebars();
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
}

/** 初始化笔记侧栏按钮。 */
export function initNotes(): void {
  if (initialized) return;
  initialized = true;
  byId("notesToggle")?.addEventListener("click", () => {
    closeAllRightSidebars();
    byId("notesPanel")?.classList.add("active");
    renderNotes();
  });
  byId("closeNotes")?.addEventListener("click", closeAllRightSidebars);
  byId("addNote")?.addEventListener("click", () => {
    void promptNote(t("noteAddPrompt")).then(text => {
      if (text && text.trim()) void addNote(text.trim()).catch(err => console.warn("addNote failed:", err));
    }).catch(err => console.warn("promptNote failed:", err));
  });
  byId("exportNotes")?.addEventListener("click", () => {
    downloadText("notes.json", JSON.stringify(getNotes(), null, 2));
  });
  // 语言切换时若面板正打开，重渲染以同步按钮/空态文案
  window.addEventListener("dictkit:langchange", () => {
    if (byId("notesPanel")?.classList.contains("active")) renderNotes();
  });
}
