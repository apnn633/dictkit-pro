// ============================================================
// viewer/buttons.ts — 查看器工具栏按钮 + 翻页箭头接线
// ============================================================

import {
    changeImage, adjustZoom, resetZoom, rotate, toggleFullscreen,
} from "./viewer.ts";
import { toggleFitWidth } from "../ui/settings.ts";
import { byId } from "../utils/dom.ts";

/** 初始化查看器工具栏按钮与翻页箭头。 */
export function initViewerButtons(): void {
    const prevBtn = byId("prevBtn");
    const nextBtn = byId("nextBtn");
    // M16：所有异步分支统一 .catch
    if (prevBtn) {
        prevBtn.addEventListener("click", () => void changeImage(false).catch(err => console.warn("changeImage failed:", err)));
        prevBtn.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void changeImage(false).catch(err => console.warn("changeImage failed:", err));
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => void changeImage(true).catch(err => console.warn("changeImage failed:", err)));
        nextBtn.addEventListener("keydown", e => {
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

    document.addEventListener("fullscreenchange", () => {
        const c = byId("resultContainer");
        if (!document.fullscreenElement && c) c.classList.remove("fullscreen");
        else if (c) c.classList.add("fullscreen");
    });
}
