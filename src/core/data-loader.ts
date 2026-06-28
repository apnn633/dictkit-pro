// ============================================================
// core/data-loader.ts — 跨本地/远程来源解析 URL 并加载数据
// ============================================================
import type { DataSource } from "../types/dict.ts";
import type { ProxyState } from "../types/state.ts";
import { state } from "./state.ts";

const PROXY_CACHE_DURATION = 30 * 60 * 1000; // 30 分钟
/** M6：单次 fetch 元数据的最长等待时间。 */
const FETCH_TIMEOUT_MS = 30_000;

/** 候选来源 + 解析后的 URL。 */
interface Candidate {
  source: DataSource;
  url: string;
}

/** 用模板生成远程 URL，替换 :owner/:repo/:branch/:filepath 占位符。 */
function buildRemoteUrl(template: string, owner: string, repo: string, branch: string, path: string): string {
  const params: Record<string, string> = { owner, repo, branch, filepath: path };
  return template.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) =>
    key in params ? params[key] : `:${key}`,
  );
}

/**
 * 为某本字典内的一条逻辑路径（如 "data/pinyin.json" 或 "images/0001.png"）
 * 生成有序的候选 URL 列表。
 *
 * 本地来源始终在前，远程镜像按优先级跟随；
 * 用户在设置里选定的来源（非 "auto"）会被提到最前。
 */
export function getCandidateUrls(repo: string, logicalPath: string): Candidate[] {
  // M17：显式检查 config 是否就绪，避免对 null 解构导致运行时崩溃。
  // 当配置未加载完成（如远程配置仍在拉取中）时，回退到仅本地候选。
  const remote = state.config?.remote;

  const out: Candidate[] = [];
  for (const source of state.dataSources) {
    if (source.type === "local") {
      // M8：读取 source.base（缺省 "data"），支持自定义本地数据根目录
      const localBase = `${source.base || "data"}/${repo}`;
      out.push({
        source,
        url: `${localBase}/${logicalPath}`,
      });
    } else if (source.type === "remote" && remote) {
      // perRepo=true：每词典独立仓库，repo 即仓库名，路径不再加 repo 子目录
      // perRepo=false（缺省）：统一仓库，路径含 repo 子目录
      const baseRemotePath = remote.perRepo
        ? `${remote.basePath}/${logicalPath}`
        : `${remote.basePath}/${repo}/${logicalPath}`;
      out.push({
        source,
        url: buildRemoteUrl(source.url, remote.owner, repo, remote.branch, baseRemotePath),
      });
    }
  }

  // 提升用户选定的来源（"auto" 除外）
  const selectedId = state.selectedDataSourceId;
  if (selectedId && selectedId !== "auto") {
    const idx = out.findIndex(c => c.source.id === selectedId);
    if (idx > 0) {
      const [chosen] = out.splice(idx, 1);
      out.unshift(chosen);
    }
  }
  return out;
}

/** 取得（必要时初始化）某类资源的代理健康状态。 */
function proxyState(kind: string): ProxyState {
  return (
    state.proxyState[kind] ||
    (state.proxyState[kind] = {
      lastSuccess: null,
      lastSuccessTime: 0,
      failed: new Set<string>(),
    })
  );
}

/** 从候选中挑出最优来源：上次成功且未过期且未失败者优先，否则取首个未失败者。 */
function getBestProxy(candidates: Candidate[], kind: string): Candidate | null {
  const ps = proxyState(kind);
  const now = Date.now();
  if (ps.lastSuccess && now - ps.lastSuccessTime >= PROXY_CACHE_DURATION) ps.failed.clear();
  if (ps.lastSuccess && now - ps.lastSuccessTime < PROXY_CACHE_DURATION) {
    const found = candidates.find(c => c.source.id === ps.lastSuccess);
    // 关键：lastSuccess 本轮已失败时不能再选它，否则 while(current) 会死循环
    if (found && !ps.failed.has(found.source.id)) return found;
  }
  return candidates.find(c => !ps.failed.has(c.source.id)) || null;
}

function markSuccess(candidate: Candidate, kind: string): void {
  const ps = proxyState(kind);
  ps.lastSuccess = candidate.source.id;
  ps.lastSuccessTime = Date.now();
  ps.failed.delete(candidate.source.id);
}

function markFail(candidate: Candidate, kind: string): void {
  proxyState(kind).failed.add(candidate.source.id);
}

/** 清空所有代理健康状态缓存。 */
export function clearProxyCache(): void {
  for (const k of Object.keys(state.proxyState)) {
    state.proxyState[k] = { lastSuccess: null, lastSuccessTime: 0, failed: new Set<string>() };
  }
  // 一并清空路径熔断集合与已加载缓存，让切换数据源后能重新尝试
  failedPaths.clear();
  loadedPaths.clear();
}

/**
 * 已彻底失败（所有源都试过且都失败）的 logicalPath 集合。
 * 同一会话内不重复请求，避免配置错误时无谓地刷请求。
 * clearProxyCache 时清空（切数据源后重置）。
 */
const failedPaths = new Set<string>();

/**
 * 已成功加载的 logicalPath → 数据 的内存缓存。
 * 避免对同一文件反复请求（如多次 loadDictData / 搜索触发）。
 * clearProxyCache 时清空。
 */
const loadedPaths = new Map<string, unknown>();

/** 从最佳可用来源加载一个 JSON 数据文件。 */
export async function loadJSON(repo: string, logicalPath: string, kind = "metadata"): Promise<unknown> {
  const failKey = `${repo}/${logicalPath}`;
  // 熔断：若该路径已彻底失败过，直接抛错，不再发请求
  if (failedPaths.has(failKey)) {
    throw new Error(`路径已熔断（所有来源均失败）：${failKey}`);
  }
  // 命中已加载缓存，直接返回，避免重复请求
  if (loadedPaths.has(failKey)) {
    return loadedPaths.get(failKey);
  }
  const candidates = getCandidateUrls(repo, logicalPath);
  let current = getBestProxy(candidates, kind);
  // 安全上限：候选数 × 2，防止任何未预见的逻辑漏洞导致死循环刷请求
  let safety = candidates.length * 2 + 2;
  while (current && safety-- > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.url, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        // 轻量校验：res.ok 但内容是原始值或 null（如 HTML 404 页被当作 JSON 解析）
        // 允许对象和数组（toc.json 顶层是数组），仅拒绝 string/number/boolean/null
        if (data === null || typeof data !== "object") {
          throw new Error("响应非 JSON 对象/数组");
        }
        markSuccess(current, kind);
        loadedPaths.set(failKey, data);
        return data;
      }
    } catch (err) {
      console.warn(`loadJSON fail [${current.source.id}] ${logicalPath}`, err);
    } finally {
      clearTimeout(timer);
    }
    markFail(current, kind);
    current = getBestProxy(candidates, kind);
  }
  if (safety < 0) console.error(`loadJSON 安全上限触发（疑似死循环）：${failKey}`);
  // 所有来源均失败：加入熔断集合，同会话不再重试
  failedPaths.add(failKey);
  throw new Error(`所有来源加载失败：${repo}/${logicalPath}`);
}

/**
 * 加载某本字典的全部数据文件（pinyin/chars/words/toc），
 * 并挂到 state.dicts[repo] 上。
 *
 * 去重保护：
 * - 若该词典所有必需文件均已加载（dict.pinyin 等非 null），直接返回
 * - 若该词典正在加载中，复用进行中的 promise，避免并发重复请求
 */
const pendingDictLoads = new Map<string, Promise<void>>();

export async function loadDictData(repo: string): Promise<void> {
  const dict = state.dicts[repo];
  if (!dict) {
    console.warn(`词典未注册：${repo}`);
    return;
  }
  // 已全部加载完成则跳过
  if (state.files.every(f => dict[f.key] != null)) return;
  // 复用进行中的加载，避免并发重复请求
  const existing = pendingDictLoads.get(repo);
  if (existing) return existing;

  const promise = (async (): Promise<void> => {
    const tasks = state.files.map(async file => {
      try {
        const data = await loadJSON(repo, `data/${file.path}`);
        dict[file.key] = data as Record<string, unknown>;
      } catch (err) {
        console.warn(`词典 ${repo} 缺少 ${file.path}：`, err);
        dict[file.key] = null;
      }
    });
    await Promise.all(tasks);
  })();
  pendingDictLoads.set(repo, promise);
  try {
    await promise;
  } finally {
    pendingDictLoads.delete(repo);
  }
}
