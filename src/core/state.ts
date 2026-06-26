// ============================================================
// core/state.ts — 单一全局状态源（响应式 store）
// ============================================================
import type { AppState } from "../types/state.ts";
import type { Defaults } from "../types/dict.ts";

/** 全局应用状态。模块级单例，所有模块共享同一份引用。 */
export const state: AppState = {
  // 配置（来自 data/dicts.json）
  config: null,
  dicts: {},            // repo -> 字典元数据（name/pages/logo/data ...）
  files: [],            // 检索文件定义
  fonts: [],            // 字体选项
  dataSources: [],      // 已排序的来源候选（local 优先）
  defaults: {} as Defaults,

  // 运行时
  currentDict: null,    // 当前字典 repo id
  currentPage: "0001",
  imageLoadToken: 0,
  isSpreadMode: false,
  zoomLevel: 100,
  rotation: 0,
  fitMode: "fit",       // "fit" | "width" | "manual"

  // 检索
  searchFilter: "all",  // "all" | "pinyin" | "chars" | "words"
  highlightedIndex: -1,

  // UI
  compareMode: false,
  compareDict: null,    // 对照模式下的第二字典 repo id

  selectedDataSourceId: "auto",

  // 缓存（不持久化）
  imageCache: new Map(),       // key -> { url, timestamp }
  loadingPromises: new Map(),  // key -> Promise
  loadingControllers: new Map(), // key -> AbortController（M7：清空时主动取消）
  preloadedImages: new Set(),
  proxyState: {
    image: { lastSuccess: null, lastSuccessTime: 0, failed: new Set<string>() },
    metadata: { lastSuccess: null, lastSuccessTime: 0, failed: new Set<string>() },
  },
};

/** 设置当前页码。 */
export function setCurrentPage(page: string): void {
  state.currentPage = String(page);
}

/** 自增并返回图片加载令牌（用于作废进行中的旧加载请求）。 */
export function nextImageLoadToken(): number {
  return ++state.imageLoadToken;
}
