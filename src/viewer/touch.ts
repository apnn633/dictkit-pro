// ============================================================
// viewer/touch.ts — 手机端触摸交互（双指缩放 / 拖拽平移 / 滑动翻页）
// 仅处理触摸事件，与桌面端 zoom.ts 分离
// ============================================================

import { state } from "../core/state.ts";
import { changeImage } from "./viewer.ts";
import { zoomTowardPoint } from "./zoom.ts";
import { byId } from "../utils/dom.ts";

type TouchMode = "pan" | "swipe" | "pinch";

interface TouchState {
    mode: TouchMode | null;
    sx: number;
    sy: number;
    sScrollX: number;
    sScrollY: number;
    sDist: number;
    sZoom: number;
}

let initialized = false;

/** 初始化手机端触摸交互。 */
export function initTouchInteraction(): void {
    if (initialized) return;
    initialized = true;
    const container = byId("resultContainer");
    const frame = document.querySelector<HTMLElement>(".viewer-frame");
    if (!container || !frame) return;

    const ts: TouchState = {
        mode: null, sx: 0, sy: 0, sScrollX: 0, sScrollY: 0,
        sDist: 0, sZoom: 0,
    };

    frame.addEventListener("touchstart", e => {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            if (!t) return;
            // 已放大 → 拖拽平移；fit (100%) → 候选滑动翻页
            ts.mode = state.zoomLevel > 100 ? "pan" : "swipe";
            ts.sx = t.clientX; ts.sy = t.clientY;
            ts.sScrollX = frame.scrollLeft; ts.sScrollY = frame.scrollTop;
        } else if (e.touches.length === 2) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            if (!t0 || !t1) return;
            ts.mode = "pinch";
            const dx = t0.clientX - t1.clientX;
            const dy = t0.clientY - t1.clientY;
            ts.sDist = Math.hypot(dx, dy);
            ts.sZoom = state.zoomLevel;
        }
    }, { passive: true });

    frame.addEventListener("touchmove", e => {
        if (ts.mode === "pan") {
            const t = e.touches[0];
            if (!t) return;
            e.preventDefault();
            frame.scrollLeft = ts.sScrollX - (t.clientX - ts.sx);
            frame.scrollTop = ts.sScrollY - (t.clientY - ts.sy);
        } else if (ts.mode === "swipe") {
            const t = e.touches[0];
            if (!t) return;
            // 明显水平方向时阻止页面纵向滚动
            if (Math.abs(t.clientX - ts.sx) > Math.abs(t.clientY - ts.sy)) {
                e.preventDefault();
            }
        } else if (ts.mode === "pinch") {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            if (!t0 || !t1) return;
            e.preventDefault();
            const dx = t0.clientX - t1.clientX;
            const dy = t0.clientY - t1.clientY;
            const dist = Math.hypot(dx, dy);
            if (ts.sDist > 0) {
                // 锚定到双指中点，使两指之间的内容保持不动
                const mx = (t0.clientX + t1.clientX) / 2;
                const my = (t0.clientY + t1.clientY) / 2;
                zoomTowardPoint(frame, mx, my, ts.sZoom * (dist / ts.sDist) - state.zoomLevel);
            }
        }
    }, { passive: false });

    frame.addEventListener("touchend", e => {
        // 滑动翻页：仅在 fit（未放大）、单指、明确水平滑动且阈值足够时触发
        if (ts.mode === "swipe" && e.changedTouches.length === 1) {
            const t = e.changedTouches[0];
            const dx = t.clientX - ts.sx;
            const dy = t.clientY - ts.sy;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                // M16：滑动翻页错误归并到 console.warn
                void changeImage(dx < 0).catch(err => console.warn("swipe changeImage failed:", err));
            }
        }
        if (e.touches.length === 0) ts.mode = null;
        // 双指 pinch 后抬一根手指：切回单指 pan/swipe，避免无法继续操作
        else if (ts.mode === "pinch" && e.touches.length === 1) {
            const t = e.touches[0];
            if (t) {
                ts.mode = state.zoomLevel > 100 ? "pan" : "swipe";
                ts.sx = t.clientX; ts.sy = t.clientY;
                ts.sScrollX = frame.scrollLeft; ts.sScrollY = frame.scrollTop;
            }
        }
    }, { passive: true });
}
