// ============================================================
// viewer/buttons.ts — 查看器工具栏按钮 + 翻页箭头接线
// ============================================================

import {
    changeImage, adjustZoom, resetZoom, rotate, toggleFullscreen,
} from "./viewer.ts";
import { toggleFitWidth } from "../ui/settings.ts";
import { byId } from "../utils/dom.ts";

let initialized = false;

/** 初始化查看器工具栏按钮与翻页箭头。 */
export function initViewerButtons(): void {
    if (initialized) return;
    initialized = true;
    const prevBtn = byId("prevBtn");
    const nextBtn = byId("nextBtn");
    // M16：所有异步分支统一 .catch
    if (prevBtn) {
        prevBtn.addEventListener("click", () => void changeImage(false).catch(err => console.warn("changeImage failed:", err)));
        prevBtn.addEventListener("keydown", e => {
            if (e.repeat) return;
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void changeImage(false).catch(err => console.warn("changeImage failed:", err));
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => void changeImage(true).catch(err => console.warn("changeImage failed:", err)));
        nextBtn.addEventListener("keydown", e => {
            if (e.repeat) return;
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void changeImage(true).catch(err => console.warn("changeImage failed:", err));
            }
        });
    }

    byId("fullscreenBtn")?.addEventListener("click", toggleFullscreen);
    byId("zoomIn")?.addEventListener("click", () => adjustZoom(20));
    byId("zoomOut")?.addEventListener("click", () => adjustZoom(-20));
    byId("zoomReset")?.addEventListener("click", resetZoom);
    byId("fitWidth")?.addEventListener("click", () => void toggleFitWidth().catch(err => console.warn("toggleFitWidth failed:", err)));
    byId("rotateBtn")?.addEventListener("click", rotate);

    const fullscreenBtn = byId("fullscreenBtn");
    const onFullscreenChange = () => {
        const c = byId("resultContainer");
        if (!c) return;
        // 仅当全屏的是本查看器容器时才加 fullscreen 类，
        // 避免页面其他元素（如视频）进入全屏时误加。
        const isFs = document.fullscreenElement === c;
        c.classList.toggle("fullscreen", isFs);
        // 同步按钮 aria-pressed 状态
        fullscreenBtn?.setAttribute("aria-pressed", String(isFs));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    // 兼容 Safari 的 webkit 前缀
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
}
