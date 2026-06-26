// ============================================================
// ui/toast.ts — 轻量全局提示气泡
// ============================================================
import { byId } from "../utils/dom.ts";

/**
 * 弹出一个轻量提示。
 * @param message  提示文本
 * @param type     info / success / warn / error（决定左侧色条）
 * @param duration 显示时长（毫秒），默认 2400
 */
export function toast(
  message: string,
  type: "info" | "success" | "warn" | "error" = "info",
  duration = 2400,
): void {
  const container = byId("toastContainer");
  if (!container) return;

  // M3：限制堆叠数量，超过 5 个移除最旧的提示
  while (container.children.length >= 5) {
    container.firstElementChild?.remove();
  }

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);

  // 下一帧再添加 show，确保过渡动画生效
  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    // 等淡出动画结束后再移除节点
    setTimeout(() => el.remove(), 300);
  }, duration);
}
