// ============================================================
// core/config.ts — 加载并规范化 dictkit 配置
// ============================================================
import type { DictConfig, PageConfig, Defaults, DictMeta } from "../types/dict.ts";
import { state } from "./state.ts";

/**
 * 配置文件候选来源。
 * - 本地开发：data/dicts.json（符号链接到数据目录）
 * - 发布到 GitHub Pages：本地 data 目录不存在，需从远程数据仓库拉取配置。
 *
 * 远程地址由 build-time 注入的 VITE_REMOTE_OWNER / VITE_REMOTE_REPO /
 * VITE_REMOTE_BRANCH / VITE_REMOTE_BASEPATH 决定，缺省回退到 dicts.json
 * 中的 remote 字段（但配置尚未加载时无法读取，故优先用环境变量）。
 */
const LOCAL_CONFIG_PATH = "data/dicts.json";

/** 从 import.meta.env 读取远程数据仓库位置（vite 构建时注入）。 */
function getRemoteBase(): { owner: string; repo: string; branch: string; basePath: string } | null {
  const env = import.meta.env;
  const owner = env.VITE_REMOTE_OWNER;
  const repo = env.VITE_REMOTE_REPO;
  if (!owner || !repo) return null;
  return {
    owner,
    repo,
    branch: env.VITE_REMOTE_BRANCH || "main",
    basePath: env.VITE_REMOTE_BASEPATH || "data",
  };
}

/** 构造远程配置文件的 jsDelivr / GitHub Raw 候选 URL。 */
function remoteConfigCandidates(): string[] {
  const r = getRemoteBase();
  if (!r) return [];
  const filepath = `${r.basePath}/dicts.json`;
  return [
    `https://cdn.jsdelivr.net/gh/${r.owner}/${r.repo}@${r.branch}/${filepath}`,
    `https://fastly.jsdelivr.net/gh/${r.owner}/${r.repo}@${r.branch}/${filepath}`,
    `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.branch}/${filepath}`,
  ];
}

/** 拉取一个 URL 的 JSON，失败抛错。M6：附加 30s 超时，避免远程配置挂起。 */
async function fetchJSON(url: string): Promise<DictConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 轻量校验：响应必须为对象（避免命中 200+HTML 的伪成功响应）
    const data = await res.json();
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("响应非对象");
    }
    // fetchJSON 已校验为对象，下方 as 断言安全
    return data as DictConfig;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 加载站点配置。
 * 优先尝试本地 data/dicts.json；失败则依次尝试远程候选 URL。
 * 填充 state.config / dicts / files / fonts / dataSources / defaults。
 */
export async function loadConfig(): Promise<DictConfig> {
  // 1) 本地（仅 dev 环境：Vite dev server 下 import.meta.env.DEV 为 true，
  //    且 data/ 符号链接存在时可用）。发布版（PROD）直接跳过，避免命中
  //    GitHub Pages 对不存在路径返回 200+HTML 的伪成功响应。
  if (import.meta.env.DEV) {
    try {
      const config = await fetchJSON(LOCAL_CONFIG_PATH);
      applyConfig(config, false);
      return config;
    } catch (err) {
      console.warn(`本地配置加载失败，尝试远程：`, err);
    }
  }
  // 2) 远程候选（发布到 GitHub Pages、无本地 data 时）
  const candidates = remoteConfigCandidates();
  if (candidates.length === 0) {
    throw new Error("配置加载失败：本地 data/dicts.json 不可用，且未配置 VITE_REMOTE_OWNER/REPO 环境变量");
  }
  let lastErr: unknown = null;
  for (const url of candidates) {
    try {
      const config = await fetchJSON(url);
      applyConfig(config, true);
      console.info(`配置已从远程加载：${url}`);
      return config;
    } catch (err) {
      lastErr = err;
      console.warn(`远程配置加载失败：${url}`, err);
    }
  }
  throw new Error(`所有配置来源均失败：${lastErr}`);
}

/** 将原始配置写入全局 state。 */
function applyConfig(config: DictConfig, fromRemote = false): void {
  state.config = config;
  state.defaults = config.defaults || ({} as Defaults);
  state.files = config.files || [];
  state.fonts = config.fonts || [];
  state.dataSources = (config.dataSources || [])
    .slice()
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  // 若配置是从远程加载的，说明本部署无本地 data 目录（如 GitHub Pages 发布版）。
  // 此时 local 数据源的每个请求都会命中站点自身的 404 页（GitHub Pages 对不存在的
  // 路径可能返回 200+HTML），既浪费往返又可能误判。移除 local 来源，让 data-loader
  // 直接走远程镜像。
  if (fromRemote) {
    state.dataSources = state.dataSources.filter(s => s.type !== "local");
  }

  // 构建字典注册表 —— 附上 logo 路径与空的数据槽
  const dicts: Record<string, DictMeta> = {};
  for (const dict of config.dicts || []) {
    if (dicts[dict.repo]) console.warn(`重复的词典 repo: ${dict.repo}，后者覆盖前者`);
    dicts[dict.repo] = {
      ...dict,
      logo: `assets/logos/${dict.repo}.png`,
      pinyin: null,
      chars: null,
      words: null,
      toc: null,
    };
  }
  state.dicts = dicts;

  // L7：currentDict 指向的 repo 已不在 dicts 中时，重置为首本
  if (state.currentDict && !dicts[state.currentDict]) {
    state.currentDict = Object.keys(dicts)[0] || null;
  }

  // M20：为顶部 logo <img> 注册 onerror 回退，避免 404 时显示破图。
  // 配置加载完成后再绑定，确保 DOM 已就绪且只绑一次。
  const logo = document.getElementById("dictLogo") as HTMLImageElement | null;
  if (logo && !logo.dataset.fallbackBound) {
    logo.dataset.fallbackBound = "1";
    logo.addEventListener("error", () => {
      if (logo.dataset.fallbackApplied) return;
      logo.dataset.fallbackApplied = "1";
      logo.src = "assets/logos/logo2.png";
    });
  }

  // 若当前未指定字典，则默认取第一本
  if (config.dicts?.length && !state.currentDict) {
    state.currentDict = config.dicts[0].repo;
  }
}

/** 某本字典缺少 pages 元数据时使用的默认页配置。 */
export const DEFAULT_PAGE: PageConfig = {
  content: { count: 1, prefix: "" },
  header: { count: 0, prefix: "A" },
  footer: { count: 0, prefix: "C" },
};

/** 取某本字典的页配置（缺省回落到 DEFAULT_PAGE）。 */
export function pageConfig(repo?: string | null): PageConfig {
  const r = repo ?? state.currentDict;
  if (r == null) return DEFAULT_PAGE;
  return state.dicts[r]?.pages || DEFAULT_PAGE;
}
