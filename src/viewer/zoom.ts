// ============================================================
// viewer/zoom.ts — 桌面端缩放交互（滚轮放大 + 鼠标拖拽平移）
// 仅处理桌面端鼠标交互，与手机端 touch.ts 分离
// ============================================================

import { state } from "../core/state.ts";
import { setZoom } from "./viewer.ts";
import { byId } from "../utils/dom.ts";

let initialized = false;

/** 初始化桌面端缩放交互（滚轮 + 鼠标拖拽）。 */
export function initDesktopZoom(): void {
    if (initialized) return;
    initialized = true;
    const container = byId("resultContainer");
    const frame = document.querySelector<HTMLElement>(".viewer-frame");
    if (!container || !frame) return;

    // 滚轮：直接缩放（无需修饰键），放大锚定到光标位置
    frame.addEventListener("wheel", e => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 15 : -15;
        zoomTowardPoint(frame, e.clientX, e.clientY, delta);
    }, { passive: false });

    // 鼠标左键拖拽平移（图片溢出时生效）
    let dragging = false;
    let dStartX = 0, dStartY = 0, dScrollX = 0, dScrollY = 0;
    frame.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        dragging = true;
        dStartX = e.clientX; dStartY = e.clientY;
        dScrollX = frame.scrollLeft; dScrollY = frame.scrollTop;
        frame.classList.add("dragging");
        e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
        if (!dragging) return;
        frame.scrollLeft = dScrollX - (e.clientX - dStartX);
        frame.scrollTop = dScrollY - (e.clientY - dStartY);
    });
    window.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        frame.classList.remove("dragging");
    });
}

/**
 * 以屏幕坐标 (clientX, clientY) 为锚点缩放，使该点下方的图片内容保持不动。
 * 适配单页 / 双面 / 对比三种模式：选取指针下方的可见图片，记录归一化坐标
 * (0..1)，缩放后把同一图片点重新对齐到指针下方。
 *
 * `delta` 为缩放级别增量。
 */
export function zoomTowardPoint(frame: HTMLElement, clientX: number, clientY: number, delta: number): void {
    // 收集当前所有可见图片
    const imgs = ["mainImage", "mainImage2", "compareImage"]
        .map(id => byId<HTMLImageElement>(id))
        .filter((el): el is HTMLImageElement =>
            !!el &&
            getComputedStyle(el).display !== "none" &&
            el.style.opacity !== "0" &&
            el.naturalWidth > 0,
        );

    // 选取距离指针最近的图片（落在某页上距离为 0；落在两页间隙则取近的）
    let img: HTMLImageElement | null = null;
    let imgRect: DOMRect | null = null;
    let bestDist = Infinity;
    for (const el of imgs) {
        const r = el.getBoundingClientRect();
        const cx = Math.min(r.right, Math.max(r.left, clientX));
        const cy = Math.min(r.bottom, Math.max(r.top, clientY));
        const d = Math.hypot(clientX - cx, clientY - cy);
        if (d < bestDist) {
            bestDist = d;
            img = el;
            imgRect = r;
        }
    }
    if (!img || !imgRect) return;

    // 指针在所选图片上的归一化坐标 (0..1)，钳制到图片范围
    let fx = (clientX - imgRect.left) / imgRect.width;
    let fy = (clientY - imgRect.top) / imgRect.height;
    fx = Math.min(1, Math.max(0, fx));
    fy = Math.min(1, Math.max(0, fy));

    const oldZoom = state.zoomLevel;
    setZoom(oldZoom + delta);
    if (state.zoomLevel === oldZoom) return; // 被钳制，无变化

    // 布局重排后，找到目标图片点在滚动容器中的新位置，对齐到指针下方
    const newRect = img.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const newImgLeftInFrame = newRect.left - frameRect.left;
    const newImgTopInFrame = newRect.top - frameRect.top;
    const targetLeft = newImgLeftInFrame + fx * newRect.width;
    const targetTop = newImgTopInFrame + fy * newRect.height;
    const pxInFrame = clientX - frameRect.left;
    const pyInFrame = clientY - frameRect.top;
    frame.scrollLeft += targetLeft - pxInFrame;
    frame.scrollTop += targetTop - pyInFrame;
}
