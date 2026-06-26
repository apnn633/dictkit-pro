// ============================================================
// ui/thumbnails.ts — 缩略图导航条（无限滚动渲染）
// ============================================================
import { byId, h, padPage, stripPage } from "../utils/dom.ts";
import { state, setCurrentPage } from "../core/state.ts";
import { pageConfig } from "../core/config.ts";
import { totalPages } from "../core/navigation.ts";
import { getImagePath, getImageUrl } from "../core/image-loader.ts";
import { t } from "./i18n.ts";

// viewer 通过动态 import 加载以打破循环依赖（字面量路径，Vite 可静态分析）
const THUMB_WIDTH = 60;
const RENDER_BATCH = 30;
/** M12：屏幕外两侧保留的缓冲批次数，超出此范围的节点会被回收。 */
const OFFSCREEN_BATCH_BUFFER = 3;
/** 每个缩略图占用的水平间距（宽度 + 间距）。 */
const THUMB_STEP = THUMB_WIDTH + 8;

let initialized = false;
let currentRange: { start: number; end: number } = { start: 0, end: 0 };
let scrollRaf = 0;
/** M18：已渲染索引集合，让"是否已渲染"判断从 O(n) 降到 O(1)。 */
const renderedIndices = new Set<number>();

/** 页码 → 跨 header/content/footer 的绝对索引（0 基）。 */
function pageToIndex(page: string): number {
  const cfg = pageConfig(state.currentDict);
  if (cfg.header.count && cfg.header.prefix && page.startsWith(cfg.header.prefix)) {
    const n = parseInt(page.slice(cfg.header.prefix.length), 10);
    return Number.isNaN(n) ? 0 : n - 1;
  }
  if (cfg.footer.count && cfg.footer.prefix && page.startsWith(cfg.footer.prefix)) {
    const n = parseInt(page.slice(cfg.footer.prefix.length), 10);
    return Number.isNaN(n) ? 0 : cfg.header.count + cfg.content.count + n - 1;
  }
  const n = parseInt(page, 10);
  return Number.isNaN(n) ? 0 : cfg.header.count + n - 1;
}

/** 绝对索引 → 页码。 */
function indexToPage(index: number): string {
  const cfg = pageConfig(state.currentDict);
  const hc = cfg.header.count;
  const cc = cfg.content.count;
  if (cfg.header.count && index < hc) {
    return `${cfg.header.prefix}${padPage(index + 1)}`;
  }
  if (cfg.content.count && index < hc + cc) {
    return padPage(index - hc + 1);
  }
  return `${cfg.footer.prefix}${padPage(index - hc - cc + 1)}`;
}

/** 异步加载某缩略图图片。 */
async function loadThumbImage(item: HTMLElement, page: string): Promise<void> {
  const repo = state.currentDict;
  if (!repo) return;
  const img = item.querySelector<HTMLImageElement>("img");
  if (!img) return;
  const path = getImagePath(page, repo);
  try {
    const url = await getImageUrl(repo, path);
    // 节点可能在 await 期间被 recycleOffscreen/renderInitialThumbs 移除，
    // 此时不再设 src，避免对已脱离 DOM 的 img 发起幽灵网络请求。
    if (!item.isConnected) return;
    img.src = url;
  } catch (err) {
    // getImageUrl 在字典切换被 abort 时会抛 AbortError，此处静默处理
    console.warn("thumb load failed:", err);
    item.classList.add("thumb-error");
  }
}

/** 构建单个缩略图节点。 */
function buildThumb(index: number): HTMLElement {
  const page = indexToPage(index);
  const left = index * THUMB_STEP + 4;
  const item = h("div", {
    class: "thumb-item",
    dataset: { index: String(index), page },
    style: { left: `${left}px` },
  }, [
    h("img", { alt: t("pageN", stripPage(page)), loading: "lazy" }),
    h("div", { class: "thumb-page" }, [stripPage(page)]),
  ]);
  void loadThumbImage(item, page);
  return item;
}

/** 渲染 [start, end) 区间内尚未渲染的缩略图。M18：用 Set O(1) 判断是否已渲染。 */
function renderRange(start: number, end: number): void {
  const spacer = byId("thumbnailTrack")?.querySelector<HTMLElement>(".thumb-spacer");
  if (!spacer) return;
  const total = totalPages(state.currentDict);
  start = Math.max(0, start);
  end = Math.min(total, end);
  for (let i = start; i < end; i++) {
    if (renderedIndices.has(i)) continue;
    spacer.appendChild(buildThumb(i));
    renderedIndices.add(i);
  }
  currentRange = {
    start: currentRange.start < 0 ? start : Math.min(currentRange.start, start),
    end: Math.max(currentRange.end, end),
  };
}

/**
 * M12：回收屏幕外两侧超出缓冲范围的已渲染节点，避免长滚动条无限增长。
 * 仅移除距离当前可见窗口较远的节点，保留 OFFSCREEN_BATCH_BUFFER 批以内的回滚体验。
 */
function recycleOffscreen(visibleStart: number, visibleEnd: number): void {
  const spacer = byId("thumbnailTrack")?.querySelector<HTMLElement>(".thumb-spacer");
  if (!spacer) return;
  const buffer = OFFSCREEN_BATCH_BUFFER * RENDER_BATCH;
  const keepStart = Math.max(0, visibleStart - buffer);
  const keepEnd = visibleEnd + buffer;
  // 遍历快照，避免在迭代中修改 Set
  for (const idx of Array.from(renderedIndices)) {
    if (idx < keepStart || idx >= keepEnd) {
      const node = spacer.querySelector<HTMLElement>(`[data-index="${idx}"]`);
      node?.remove();
      renderedIndices.delete(idx);
    }
  }
}

/** 初始渲染：建立 spacer、渲染当前页附近窗口并滚动到当前页。 */
function renderInitialThumbs(): void {
  const track = byId("thumbnailTrack");
  if (!track) return;
  track.innerHTML = "";
  // M18：重置已渲染索引集合，与 DOM 同步清空
  renderedIndices.clear();
  const total = totalPages(state.currentDict);

  const spacer = h("div", { class: "thumb-spacer" });
  spacer.style.width = `${total * THUMB_STEP + 8}px`;
  track.appendChild(spacer);

  currentRange = { start: 0, end: 0 };
  const center = pageToIndex(state.currentPage);
  const start = Math.max(0, center - Math.floor(RENDER_BATCH / 2));
  const end = Math.min(total, start + RENDER_BATCH);
  renderRange(start, end);

  // 滚动使当前页居中
  const target = center * THUMB_STEP - track.clientWidth / 2;
  track.scrollTo({ left: Math.max(0, target), behavior: "auto" });
}

/** 滚动时计算可见区间并按需渲染，同时回收远端节点（M12）。 */
function scheduleInfiniteScroll(): void {
  const track = byId("thumbnailTrack");
  if (!track) return;
  const total = totalPages(state.currentDict);
  const startIdx = Math.max(0, Math.floor(track.scrollLeft / THUMB_STEP) - RENDER_BATCH);
  const endIdx = Math.min(total, Math.ceil((track.scrollLeft + track.clientWidth) / THUMB_STEP) + RENDER_BATCH);
  renderRange(startIdx, endIdx);
  recycleOffscreen(startIdx, endIdx);
}

/** rAF 节流的滚动回调。 */
function onTrackScroll(): void {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    scheduleInfiniteScroll();
  });
}

/** 从缩略图跳转到对应页。 */
async function jumpFromThumb(page: string): Promise<void> {
  setCurrentPage(page);
  const mod = await import("../viewer/viewer.ts");
  await mod.showImage();
  highlightActiveThumb();
}

/**
 * 高亮当前页对应的缩略图。
 * M18：直接定位当前页索引对应的节点，无需遍历全部 .thumb-item。
 */
export function highlightActiveThumb(): void {
  const track = byId("thumbnailTrack");
  if (!track) return;
  const idx = pageToIndex(state.currentPage);
  // 先清除现有高亮（仅遍历当前已渲染节点，数量受 recycleOffscreen 控制）
  track.querySelectorAll<HTMLElement>(".thumb-item.active").forEach(el => el.classList.remove("active"));
  const cur = track.querySelector<HTMLElement>(`.thumb-item[data-index="${idx}"]`);
  cur?.classList.add("active");
}

/** 刷新缩略图（切换词典后调用）。 */
export function refreshThumbnails(): void {
  if (!initialized) return;
  renderInitialThumbs();
  highlightActiveThumb();
}

/** 初始化缩略图导航条。 */
export function initThumbnails(): void {
  if (initialized) return;
  initialized = true;

  byId("thumbToggle")?.addEventListener("click", () => {
    const bar = byId("thumbnailBar");
    if (!bar) return;
    const willOpen = !bar.classList.contains("expanded");
    bar.classList.toggle("expanded");
    if (willOpen) renderInitialThumbs();
    highlightActiveThumb();
  });

  const track = byId("thumbnailTrack");
  track?.addEventListener("scroll", onTrackScroll, { passive: true });
  track?.addEventListener("click", (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(".thumb-item");
    if (!item) return;
    const page = item.dataset.page;
    if (!page) return;
    void jumpFromThumb(page).catch(err => console.warn("jumpFromThumb failed:", err));
  });
}
