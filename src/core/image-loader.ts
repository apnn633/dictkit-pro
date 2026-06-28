// ============================================================
// core/image-loader.ts — 图片加载（带缓存与预加载）
// ============================================================
import { state } from "./state.ts";
import { getCandidateUrls } from "./data-loader.ts";
import { shiftPage } from "./navigation.ts";
import { idle } from "../utils/dom.ts";

const IMAGE_CACHE_CONFIG = {
  maxCacheSize: 200,
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 小时
  preloadCount: 2,
  /** M6：单张图片加载最长等待时间，超时认为该来源失败。 */
  loadTimeoutMs: 15_000,
};

/**
 * 已彻底失败（所有来源都试过）的图片 cacheKey 集合。
 * 同一会话内不重复请求，避免配置错误时刷请求。
 * clearDictCache 时清空（切词典后重置）。
 */
const failedImages = new Set<string>();

/** 根据页码解析其逻辑图片路径。 */
export function getImagePath(page: string, repo?: string | null): string {
  const r = repo ?? state.currentDict;
  const dict = r != null ? state.dicts[r] : undefined;
  const pages = dict?.pages;
  const headerPrefix = pages?.header.prefix;
  const footerPrefix = pages?.footer.prefix;
  const isExtra =
    (headerPrefix != null && page.startsWith(headerPrefix)) ||
    (footerPrefix != null && page.startsWith(footerPrefix));
  const dir = isExtra ? "extra" : "images";
  const suffix = state.config?.defaults?.imageSuffix || "png";
  return `${dir}/${page}.${suffix}`;
}

function cacheKey(repo: string, imagePath: string): string {
  return `${repo}::${imagePath}`;
}

function isCached(repo: string, imagePath: string): boolean {
  const key = cacheKey(repo, imagePath);
  const entry = state.imageCache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.timestamp > IMAGE_CACHE_CONFIG.cacheExpiry) {
    state.imageCache.delete(key);
    return false;
  }
  // 命中时重新插入到 Map 末尾，使其成为"最近使用"，保持真正的 LRU 顺序
  state.imageCache.delete(key);
  state.imageCache.set(key, entry);
  return true;
}

function getCached(repo: string, imagePath: string): string | null {
  return state.imageCache.get(cacheKey(repo, imagePath))?.url ?? null;
}

function setCached(repo: string, imagePath: string, url: string): void {
  const key = cacheKey(repo, imagePath);
  // 已存在则先删除，确保新条目落在 Map 末尾（最近使用）
  state.imageCache.delete(key);
  if (state.imageCache.size >= IMAGE_CACHE_CONFIG.maxCacheSize) {
    // Map 按插入顺序迭代，首项即最久未使用
    const oldest = state.imageCache.keys().next().value;
    if (oldest !== undefined) state.imageCache.delete(oldest);
  }
  state.imageCache.set(key, { url, timestamp: Date.now() });
}

/**
 * 加载一个 Image 元素，成功时 resolve 出该 url。
 * M6：附加超时与 AbortSignal —— signal 被 abort 时立刻 reject，
 * 避免单张图片网络挂起拖死整页加载。
 */
function loadImageElement(url: string, signal: AbortSignal): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const img = new Image();
    img.decoding = "async";
    const timer = setTimeout(() => {
      img.removeAttribute("src");
      reject(new Error(`图片加载超时：${url}`));
    }, IMAGE_CACHE_CONFIG.loadTimeoutMs);
    const onAbort = (): void => {
      clearTimeout(timer);
      img.removeAttribute("src");
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    img.onload = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new Error(`图片加载失败：${url}`));
    };
    img.src = url;
  });
}

/** 依次尝试各候选来源，返回首个能加载成功的 url。 */
async function loadImageFromSources(repo: string, imagePath: string, signal: AbortSignal): Promise<string> {
  const candidates = getCandidateUrls(repo, imagePath);
  for (const candidate of candidates) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const url = await loadImageElement(candidate.url, signal);
      return url;
    } catch (err) {
      if (signal.aborted) throw err;
      console.warn(`image load fail [${candidate.source.id}] ${repo}/${imagePath}`, err);
    }
  }
  // 所有来源均失败：记入熔断集合，同会话不再重试该图
  failedImages.add(cacheKey(repo, imagePath));
  throw new Error(`所有来源图片加载失败：${repo}/${imagePath}`);
}

/** 取得某张图片的可显示 URL，结果会被缓存。 */
export async function getImageUrl(repo: string, imagePath: string): Promise<string> {
  if (isCached(repo, imagePath)) {
    const url = getCached(repo, imagePath);
    if (url != null) return url;
  }
  const key = cacheKey(repo, imagePath);
  // 熔断：若该图已彻底失败过，直接抛错，不再发请求
  if (failedImages.has(key)) {
    throw new Error(`图片已熔断（所有来源均失败）：${repo}/${imagePath}`);
  }
  const existing = state.loadingPromises.get(key);
  if (existing) return existing;

  // M7：每条加载请求关联一个 AbortController，clearDictCache 时主动 abort，
  // 避免切换词典后旧请求仍占用网络与内存。
  const controller = new AbortController();
  state.loadingControllers.set(key, controller);
  const promise = loadImageFromSources(repo, imagePath, controller.signal);
  state.loadingPromises.set(key, promise);
  try {
    const url = await promise;
    setCached(repo, imagePath, url);
    return url;
  } finally {
    // M1：按引用删除，避免并发请求间互相清理造成竞态
    if (state.loadingPromises.get(key) === promise) state.loadingPromises.delete(key);
    if (state.loadingControllers.get(key) === controller) state.loadingControllers.delete(key);
  }
}

/** 加载某页图片，并在空闲时段预加载相邻页。 */
export async function preloadPage(page: string, limit = IMAGE_CACHE_CONFIG.preloadCount): Promise<string> {
  const repo = state.currentDict;
  if (!repo) throw new Error("当前未选择词典");
  const path = getImagePath(page, repo);
  const url = await getImageUrl(repo, path);
  if (limit > 0) {
    idle(() => preloadAdjacent(page, limit, repo));
  }
  return url;
}

/** 预加载中心页前后的相邻页。 */
function preloadAdjacent(centerPage: string, limit: number, repo: string): void {
  // 切词典后旧 idle 回调可能仍触发：若词典已变更，放弃旧预加载，
  // 避免对旧词典发起无效请求并回写已清空的缓存。
  if (state.currentDict !== repo) return;
  for (let offset = -limit; offset <= limit; offset++) {
    if (offset === 0) continue;
    const page = shiftPage(centerPage, offset, repo);
    if (page === centerPage) continue;
    const path = getImagePath(page, repo);
    const key = cacheKey(repo, path);
    if (isCached(repo, path) || state.preloadedImages.has(key)) continue;
    // M5：preloadedImages 无界增长，超过阈值时清空避免内存膨胀
    if (state.preloadedImages.size > 500) state.preloadedImages.clear();
    state.preloadedImages.add(key);
    getImageUrl(repo, path).catch(() => state.preloadedImages.delete(key));
  }
}

/**
 * 清空某本字典的图片缓存（切换字典时使用）。
 * M7：同时 abort 该字典所有在飞的加载请求，避免旧请求继续消耗网络带宽
 * 与回写已清空的缓存条目。
 */
export function clearDictCache(repo: string): void {
  const prefix = `${repo}::`;
  for (const key of Array.from(state.imageCache.keys())) {
    if (key.startsWith(prefix)) state.imageCache.delete(key);
  }
  for (const key of Array.from(state.loadingPromises.keys())) {
    if (key.startsWith(prefix)) state.loadingPromises.delete(key);
  }
  for (const [key, controller] of Array.from(state.loadingControllers.entries())) {
    if (key.startsWith(prefix)) {
      controller.abort();
      state.loadingControllers.delete(key);
    }
  }
  for (const key of Array.from(state.preloadedImages)) {
    if (key.startsWith(prefix)) state.preloadedImages.delete(key);
  }
  // 一并清除该词典的图片熔断记录，让切换数据源后能重新尝试
  for (const key of Array.from(failedImages)) {
    if (key.startsWith(prefix)) failedImages.delete(key);
  }
}

/**
 * 清空全部图片内存缓存与在飞请求（所有词典）。
 * 供设置面板「清理缓存」按钮调用：清空 imageCache / loadingPromises /
 * loadingControllers（主动 abort）/ preloadedImages / failedImages。
 * 不影响 SW 持久化缓存（由调用方另行 caches.delete）。
 */
export function clearAllImageCache(): void {
  for (const [, controller] of state.loadingControllers) controller.abort();
  state.imageCache.clear();
  state.loadingPromises.clear();
  state.loadingControllers.clear();
  state.preloadedImages.clear();
  failedImages.clear();
}
