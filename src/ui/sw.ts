// ============================================================
// ui/sw.ts — Service Worker 注册（PWA 离线支持）
// ============================================================

/**
 * 注册 Service Worker。
 *
 * 注：vite-plugin-pwa 在自动更新模式下会注入自身的注册逻辑；
 * 此处作为兜底手动注册 /sw.js，失败仅告警不阻断。
 */
export function initServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const proto = location.protocol;
  if (proto !== "http:" && proto !== "https:") return;

  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err: unknown) => {
      console.warn("Service Worker 注册失败：", err);
    });
  });
}
