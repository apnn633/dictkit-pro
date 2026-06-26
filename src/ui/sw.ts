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

  const register = () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).then(reg => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // 有新版本，可提示用户刷新（这里用 console 提示，避免引入 toast 依赖）
            console.info("新版本已就绪，刷新后生效");
          }
        });
      });
    }).catch((err: unknown) => {
      console.warn("Service Worker 注册失败：", err);
    });
  };
  // H5：调用时 load 可能已触发，需检查 readyState，否则 SW 永不注册
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
