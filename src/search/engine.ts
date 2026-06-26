// ============================================================
// search/engine.ts — 词典检索引擎
// ============================================================
import type { SearchResult, SearchOptions, SearchFilter, SearchFileKey } from "../types/search.ts";
import { state } from "../core/state.ts";
import { isNumeric, normalizePageId } from "../core/navigation.ts";
import { normalizePinyin, pinyinToAscii, fuzzyScore } from "./pinyin.ts";
import { padPage } from "../utils/dom.ts";

/**
 * 在当前字典中检索。
 *
 * 支持：
 *  - 纯数字输入 → 翻页信号（由调用方处理）
 *  - 拼音简写归一化（v → ü，ẑ ĉ ŝ → zh/ch/sh）
 *  - 按分类过滤（pinyin / chars / words / all）
 *  - 命中失败时回退到子序列模糊匹配
 *
 * 返回 { term, page, type, key, score, dictRepo } 数组。
 */
export function searchDictionary(query: string, opts?: SearchOptions): SearchResult[] {
  const limit = opts?.limit ?? state.defaults.maxResults ?? 12;
  const filter: SearchFilter = opts?.filter ?? state.searchFilter;
  const repo = opts?.repo ?? state.currentDict;
  if (!repo) return [];
  const dict = state.dicts[repo];
  if (!dict) return [];

  const raw = String(query).trim();
  if (!raw) return [];

  // 纯数字 → 调用方决定是否翻页；引擎返回空，调用方靠 isNumeric(query) 判断
  if (isNumeric(raw)) return [];

  const normalized = raw.toLowerCase();
  const pinyinQuery = normalizePinyin(normalized);
  const asciiQuery = pinyinToAscii(normalized);

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const maxLimit = limit * 3;
  const files = state.files.filter(f => filter === "all" || f.key === filter);

  // 用 const 箭头（而非 function 声明）以保留上方 `if (!repo) return` 对 repo 的窄化
  const push = (
    term: string,
    page: string | number,
    type: string,
    key: SearchFileKey,
    weight: number,
    baseScore: number,
  ): void => {
    const pageId = padPage(page);
    const dedupe = `${key}:${term}:${pageId}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    results.push({
      term,
      page: pageId,
      type,
      key,
      score: baseScore + weight,
      dictRepo: repo,
    });
  };

  for (const file of files) {
    const data = dict[file.key];
    if (!data || typeof data !== "object") continue;

    // 拼音：先对归一化形式做精确/前缀匹配（特殊路径）
    if (file.key === "pinyin" && pinyinQuery !== normalized) {
      if (Object.prototype.hasOwnProperty.call(data, pinyinQuery)) {
        for (const page of toArray(data[pinyinQuery])) {
          push(pinyinQuery, page, file.type, file.key, file.weight, 0);
        }
      }
    }

    for (const [term, value] of Object.entries(data)) {
      const termLower = term.toLowerCase();
      let matched = false;
      let baseScore = Number.MAX_SAFE_INTEGER;

      if (file.key === "pinyin") {
        // 比较归一化后的拼音
        const termNorm = normalizePinyin(termLower);
        if (termNorm === pinyinQuery) { matched = true; baseScore = 0; }
        else if (termNorm.startsWith(pinyinQuery)) { matched = true; baseScore = 1; }
        else if (termNorm.includes(pinyinQuery)) { matched = true; baseScore = 2; }
        else {
          // ASCII 回退，兼容不带声调的输入
          const termAscii = pinyinToAscii(term);
          if (termAscii === asciiQuery) { matched = true; baseScore = 1; }
          else if (termAscii.startsWith(asciiQuery)) { matched = true; baseScore = 2; }
          else if (termAscii.includes(asciiQuery)) { matched = true; baseScore = 3; }
        }
      } else {
        if (termLower === normalized) { matched = true; baseScore = 0; }
        else if (termLower.startsWith(normalized)) { matched = true; baseScore = 1; }
        else if (termLower.endsWith(normalized)) { matched = true; baseScore = 2; }
        else if (termLower.includes(normalized)) { matched = true; baseScore = 3; }
        else {
          const fs = fuzzyScore(termLower, normalized);
          if (fs < Number.MAX_SAFE_INTEGER) { matched = true; baseScore = 4 + fs; }
        }
      }

      if (matched) {
        for (const page of toArray(value)) {
          push(term, page, file.type, file.key, file.weight, baseScore);
        }
      }
      if (results.length >= maxLimit) break;
    }
    if (results.length >= maxLimit) break;
  }

  return results
    .sort((a, b) => a.score - b.score || a.page.localeCompare(b.page))
    .slice(0, limit);
}

/** 把单值或数组统一成数组。 */
function toArray(value: unknown): Array<string | number> {
  return Array.isArray(value) ? (value as Array<string | number>) : [value as string | number];
}

/** 将纯数字查询解析为合法页码（超出范围返回 null）。 */
export function resolveNumericPage(query: string, repo?: string | null): string | null {
  if (!isNumeric(query)) return null;
  return normalizePageId(query, repo);
}
