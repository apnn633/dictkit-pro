// ============================================================
// search/highlight.ts — 命中词高亮（生成带 <mark> 的安全 HTML）
// ============================================================
import type { HighlightOptions } from "../types/search.ts";
import { escapeHtml } from "../utils/dom.ts";

/** 解析高亮选项，给出默认值。 */
function resolveOpts(opts?: HighlightOptions): { tag: string; className: string | undefined; caseInsensitive: boolean } {
  return {
    tag: opts?.tag ?? "mark",
    className: opts?.className,
    caseInsensitive: opts?.caseInsensitive ?? true,
  };
}

/** 构造开闭标签（className 已转义）。 */
function buildTags(tag: string, className: string | undefined): { open: string; close: string } {
  const open = className ? `<${tag} class="${escapeHtml(className)}">` : `<${tag}>`;
  return { open, close: `</${tag}>` };
}

/**
 * 在 term 中高亮首个命中的 query 子串。
 * 全部 HTML 均会转义；默认大小写不敏感；未命中时返回转义后的原词。
 */
export function highlightTerm(term: string, query: string, opts?: HighlightOptions): string {
  let { tag, className, caseInsensitive } = resolveOpts(opts);
  // 防御：tag 必须是合法的 HTML 标签名，否则回退到 mark
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tag)) tag = "mark";
  const t = String(term);
  const q = String(query);
  if (!q) return escapeHtml(t);

  const tLower = caseInsensitive ? t.toLowerCase() : t;
  const qLower = caseInsensitive ? q.toLowerCase() : q;
  const idx = tLower.indexOf(qLower);
  if (idx === -1) return escapeHtml(t);

  const { open, close } = buildTags(tag, className);
  return (
    escapeHtml(t.slice(0, idx)) +
    open + escapeHtml(t.slice(idx, idx + q.length)) + close +
    escapeHtml(t.slice(idx + q.length))
  );
}

/**
 * 在 text 中高亮所有 query 子串。
 * 按 query 长度降序处理，已标记的字符不再重复标记，避免出现嵌套 <mark>。
 */
export function highlightMatches(text: string, queries: string[], opts?: HighlightOptions): string {
  const { tag, className, caseInsensitive } = resolveOpts(opts);
  const t = String(text);
  // 长度降序，避免短串嵌套进长串内部
  const sortedQueries = [...queries]
    .map(q => String(q))
    .filter(q => q.length > 0)
    .sort((a, b) => b.length - a.length);

  const tLower = caseInsensitive ? t.toLowerCase() : t;
  const matched: boolean[] = Array.from({ length: t.length }, () => false);
  const ranges: Array<[number, number]> = [];

  for (const q of sortedQueries) {
    const qLower = caseInsensitive ? q.toLowerCase() : q;
    let from = 0;
    while (from <= t.length) {
      const idx = tLower.indexOf(qLower, from);
      if (idx === -1) break;
      // 仅当该区间内没有任何字符已被标记时才标记
      let conflict = false;
      for (let i = idx; i < idx + q.length; i++) {
        if (matched[i]) { conflict = true; break; }
      }
      if (!conflict) {
        for (let i = idx; i < idx + q.length; i++) matched[i] = true;
        ranges.push([idx, idx + q.length]);
      }
      from = idx + 1;
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const { open, close } = buildTags(tag, className);

  let result = "";
  let pos = 0;
  for (const [start, end] of ranges) {
    result += escapeHtml(t.slice(pos, start));
    result += open + escapeHtml(t.slice(start, end)) + close;
    pos = end;
  }
  result += escapeHtml(t.slice(pos));
  return result;
}
