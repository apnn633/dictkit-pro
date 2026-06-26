// ============================================================
// viewer/viewer.ts — 主图片查看器（单页 / 双面 / 对比）
// ============================================================

import { state, setCurrentPage, nextImageLoadToken } from "../core/state.ts";
import { pageConfig } from "../core/config.ts";
import { preloadPage, getImageUrl, getImagePath } from "../core/image-loader.ts";
import { isContentPage, getFirstPageId, getLastPageId, shiftPage, totalPages } from "../core/navigation.ts";
import { byId, padPage } from "../utils/dom.ts";
import { syncURL } from "../ui/url-sync.ts";
import { recordHistory } from "../ui/history.ts";
import { updateProgress } from "../ui/progress.ts";
import { t } from "../ui/i18n.ts";

const EMPTY_IMAGE = "assets/empty.svg";
const FIRST_PAGE_ID = "0001";
const DEFAULT_IMAGE = `assets/${FIRST_PAGE_ID}.png`;

function isSpreadActive(): boolean {
    return state.isSpreadMode && isContentPage(state.currentPage);
}

function isCompareActive(): boolean {
    return state.compareMode && !!state.compareDict && state.compareDict !== state.currentDict;
}

/** 渲染当前页（处理 单页 / 双面 / 对比 三种变体）。 */
export async function showImage(limit = 0): Promise<void> {
    const img = byId<HTMLImageElement>("mainImage");
    const img2 = byId<HTMLImageElement>("mainImage2");
    const cmp = byId<HTMLImageElement>("compareImage");
    const container = byId("resultContainer");
    const token = nextImageLoadToken();

    try {
        container?.classList.add("is-loading");
        setStatus(t("loading"));
        syncSpreadClass();

        if (isCompareActive()) {
            await loadCompareView(img, img2, cmp, token);
        } else if (isSpreadActive()) {
            await loadSpreadView(img, img2, token);
        } else {
            await loadSingleView(img, img2, limit, token);
        }
    } catch (err) {
        if (token === state.imageLoadToken) {
            setStatus(t("loadFailed"));
            console.error(err);
            if (img) { img.src = DEFAULT_IMAGE; img.style.opacity = "0.3"; }
            if (img2) { img2.src = ""; img2.style.opacity = "0"; }
            if (cmp) { cmp.src = ""; cmp.style.opacity = "0"; }
        }
    } finally {
        if (token === state.imageLoadToken) {
            container?.classList.remove("is-loading");
            updatePageIndicator();
            applyZoomToImages();
            updateURLState();
            // 翻页/模式切换后重置滚动位置（仅放大状态下需要，避免上一页的偏移残留）
            if (state.zoomLevel > 100) {
                const frame = document.querySelector<HTMLElement>(".viewer-frame");
                if (frame) { frame.scrollLeft = 0; frame.scrollTop = 0; }
            }
        }
    }
}

function setStatus(msg: string): void {
    const el = byId("searchResult");
    if (el) el.textContent = msg;
}

function syncSpreadClass(): void {
    const el = byId("resultContainer");
    if (!el) return;
    // 记录旧模式，检测到模式实际变化时重置缩放，避免上一模式的缩放/偏移残留
    const wasSpread = el.classList.contains("spread-mode");
    const wasCompare = el.classList.contains("compare-mode");
    const willSpread = isSpreadActive();
    const willCompare = isCompareActive();
    el.classList.toggle("spread-mode", willSpread);
    el.classList.toggle("compare-mode", willCompare);
    if (wasSpread !== willSpread || wasCompare !== willCompare) {
        resetZoom();
    }
}

async function loadSingleView(
    img: HTMLImageElement | null,
    img2: HTMLImageElement | null,
    limit: number,
    token: number,
): Promise<void> {
    const url = await preloadPage(state.currentPage, limit);
    if (token !== state.imageLoadToken) return;
    if (img) { img.src = url; img.style.opacity = "1"; }
    if (img2) { img2.src = ""; img2.style.opacity = "0"; }
    setStatus("");
}

async function loadSpreadView(
    img: HTMLImageElement | null,
    img2: HTMLImageElement | null,
    token: number,
): Promise<void> {
    const num = parseInt(state.currentPage, 10);

    if (num === 1) {
        const url = await preloadPage(state.currentPage, 0);
        if (token !== state.imageLoadToken) return;
        if (img) { img.src = EMPTY_IMAGE; img.style.opacity = "1"; }
        if (img2) { img2.src = url; img2.style.opacity = "1"; }
    } else if (num % 2 === 1) {
        const left = padPage(num - 1);
        const [leftUrl, rightUrl] = await Promise.all([
            preloadPage(left, 0),
            preloadPage(state.currentPage, 0),
        ]);
        if (token !== state.imageLoadToken) return;
        if (img) { img.src = leftUrl; img.style.opacity = "1"; }
        if (img2) { img2.src = rightUrl; img2.style.opacity = "1"; }
    } else {
        const [url, url2] = await Promise.all([
            preloadPage(state.currentPage, 0),
            getSecondPageUrl(),
        ]);
        if (token !== state.imageLoadToken) return;
        if (img) { img.src = url; img.style.opacity = "1"; }
        if (img2) { img2.src = url2 || EMPTY_IMAGE; img2.style.opacity = "1"; }
    }
    setStatus("");
}

async function getSecondPageUrl(): Promise<string | null> {
    const num = parseInt(state.currentPage, 10);
    if (Number.isNaN(num) || num < 2 || num % 2 === 1) return null;
    const cfg = pageConfig();
    if (num + 1 > cfg.content.count) return null;
    const repo = state.currentDict;
    if (!repo) return null;
    const path = getImagePath(padPage(num + 1), repo);
    return getImageUrl(repo, path);
}

async function loadCompareView(
    img: HTMLImageElement | null,
    img2: HTMLImageElement | null,
    cmp: HTMLImageElement | null,
    token: number,
): Promise<void> {
    const url = await preloadPage(state.currentPage, 0);
    if (token !== state.imageLoadToken) return;
    let cmpUrl: string | null = null;
    try {
        const cmpRepo = state.compareDict;
        if (!cmpRepo) throw new Error("compare dict not set");
        const cfg = pageConfig(cmpRepo);
        const target = isContentPage(state.currentPage)
            ? clampPageToContent(state.currentPage, cfg)
            : getFirstPageId(cmpRepo);
        if (target) {
            cmpUrl = await getImageUrl(cmpRepo, getImagePath(target, cmpRepo));
        }
    } catch (err) {
        console.warn("compare image load failed", err);
    }
    if (token !== state.imageLoadToken) return;
    if (img) { img.src = url; img.style.opacity = "1"; }
    if (img2) { img2.src = ""; img2.style.opacity = "0"; }
    if (cmp) {
        cmp.src = cmpUrl || EMPTY_IMAGE;
        cmp.style.opacity = cmpUrl ? "1" : "0.3";
    }
    setStatus("");
}

function clampPageToContent(page: string, cfg: ReturnType<typeof pageConfig>): string | null {
    const n = parseInt(page, 10);
    if (Number.isNaN(n)) return null;
    if (n < 1) return padPage(1);
    if (n > cfg.content.count) return padPage(cfg.content.count);
    return padPage(n);
}

/** 翻到上/下一页，双面模式按 2 页步进。 */
export async function changeImage(forward: boolean): Promise<void> {
    if (isSpreadActive()) {
        const num = parseInt(state.currentPage, 10);
        if (!Number.isNaN(num)) {
            if (!forward && num <= 1) {
                // 落到单页边界处理
            } else {
                const cfg = pageConfig();
                const currentEven = num <= 1 ? 1 : (num % 2 === 0 ? num : num - 1);
                const target = forward
                    ? (currentEven <= 1 ? 2 : Math.min(currentEven + 2, cfg.content.count))
                    : Math.max(currentEven - 2, 2);
                if (target !== num) {
                    setCurrentPage(padPage(target));
                    await showImage(state.defaults.preloadCount ?? 2);
                    return;
                }
            }
        }
    }
    setCurrentPage(shiftPage(state.currentPage, forward ? 1 : -1));
    await showImage(state.defaults.preloadCount ?? 2);
}

/** 跳转 N 页。 */
export async function jumpBy(n: number): Promise<void> {
    if (!n) return;
    setCurrentPage(shiftPage(state.currentPage, n));
    await showImage(state.defaults.preloadCount ?? 2);
}

export async function gotoFirst(): Promise<void> {
    setCurrentPage(getFirstPageId());
    await showImage(state.defaults.preloadCount ?? 2);
}

export async function gotoLast(): Promise<void> {
    let target: string;
    if (state.isSpreadMode) {
        const cfg = pageConfig();
        const total = cfg.content.count;
        // M4：小词典保护——内容页不足 2 页时直接用首/末页，避免凭空生成 "0002"
        if (total < 2) {
            target = total <= 0 ? FIRST_PAGE_ID : padPage(total);
        } else {
            // 双页模式落到末尾的偶数页（与左页对开）
            let last = total % 2 === 1 ? total - 1 : total;
            target = padPage(last);
        }
    } else {
        target = getLastPageId();
    }
    setCurrentPage(target);
    await showImage(state.defaults.preloadCount ?? 2);
}

function updatePageIndicator(): void {
    const el = byId("pageIndicator");
    if (!el) return;
    const cfg = pageConfig();
    const total = totalPages();
    const cur = state.currentPage;
    if (isSpreadActive()) {
        const num = parseInt(cur, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= cfg.content.count) {
            let text: string;
            if (num === 1) {
                text = `${FIRST_PAGE_ID} / ${padPage(total)}`;
            } else if (num % 2 === 1) {
                text = `${padPage(num - 1)} · ${cur} / ${padPage(total)}`;
            } else {
                const right = num + 1 <= cfg.content.count ? ` · ${padPage(num + 1)}` : "";
                text = `${cur}${right} / ${padPage(total)}`;
            }
            el.textContent = text;
            return;
        }
    }
    el.textContent = `${cur} / ${padPage(total)}`;
}

function updateURLState(): void {
    syncURL();
    const repo = state.currentDict;
    if (repo) recordHistory({ dict: repo, page: state.currentPage });
    updateProgress();
}

/**
 * 把当前 zoom/rotation 应用到查看器图片。
 * 注意：此处不自动居中滚动——需要锚点的调用方（wheel/touch）通过
 * zoom.ts 的 zoomTowardPoint 自行调整 scrollLeft/Top。
 */
export function applyZoomToImages(): void {
    const container = byId("resultContainer");
    if (!container) return;
    container.style.setProperty("--zoom", String(state.zoomLevel));
    container.style.setProperty("--rotation", `${state.rotation}deg`);
    container.classList.toggle("is-zoomed", state.zoomLevel > 100);
    const disp = byId("zoomDisplay");
    if (disp) disp.textContent = `${state.zoomLevel}%`;
}

export function setZoom(level: number): void {
    state.zoomLevel = Math.max(50, Math.min(400, Math.round(level)));
    applyZoomToImages();
}

export function adjustZoom(delta: number): void {
    setZoom(state.zoomLevel + delta);
}

export function resetZoom(): void {
    state.zoomLevel = 100;
    state.rotation = 0;
    // 保留当前适应模式（由 settings.ts 维护，state.fitMode 为单一真源）
    applyZoomToImages();
}

export function rotate(): void {
    state.rotation = (state.rotation + 90) % 360;
    applyZoomToImages();
}

export function toggleFullscreen(): void {
    const container = byId("resultContainer");
    if (!container) return;
    if (document.fullscreenElement) {
        // 兼容 Safari 的 webkit 前缀
        const ex: (() => Promise<void>) | undefined =
            document.exitFullscreen || (document as any).webkitExitFullscreen;
        if (ex) {
            const ret = ex.call(document);
            if (ret && typeof (ret as any).catch === "function") (ret as Promise<void>).catch(() => {});
        }
    } else {
        const rq: (() => Promise<void>) | undefined =
            container.requestFullscreen || (container as any).webkitRequestFullscreen;
        if (rq) {
            const ret = rq.call(container);
            if (ret && typeof (ret as any).catch === "function") (ret as Promise<void>).catch(() => {});
        }
    }
}
