// ============================================================
// core/navigation.ts — 页码归一化与翻页
// ============================================================
import { pageConfig } from "./config.ts";
import { padPage } from "../utils/dom.ts";

/** 判断字符串是否为正整数（不含前导 0）。 */
export function isNumeric(str: string): boolean {
  return /^[1-9]\d*$/.test(str.trim());
}

/** 校验页码在某本字典的页配置下是否合法。 */
export function isValidPageId(page: string, repo?: string | null): boolean {
  const cfg = pageConfig(repo);
  const id = page.trim();
  if (!id) return false;

  const contentCount = cfg.content.count;
  const headerCount = cfg.header.count;
  const footerCount = cfg.footer.count;

  if (isNumeric(id)) {
    const n = parseInt(id, 10);
    return n > 0 && n <= contentCount;
  }
  if (cfg.header.prefix && id.startsWith(cfg.header.prefix)) {
    const n = parseInt(id.slice(cfg.header.prefix.length), 10);
    return n > 0 && n <= headerCount;
  }
  if (cfg.footer.prefix && id.startsWith(cfg.footer.prefix)) {
    const n = parseInt(id.slice(cfg.footer.prefix.length), 10);
    return n > 0 && n <= footerCount;
  }
  return false;
}

/** 将原始页码归一化为补零后的规范形式。 */
export function normalizePageId(page: string, repo?: string | null): string | null {
  const id = page.trim();
  if (!isValidPageId(id, repo)) return null;
  const cfg = pageConfig(repo);
  if (isNumeric(id)) return padPage(id);
  // 补齐 header/footer 页码的数字部分（如 "A1" → "A0001"）
  if (cfg.header.count && id.startsWith(cfg.header.prefix)) {
    return cfg.header.prefix + padPage(id.slice(cfg.header.prefix.length));
  }
  if (cfg.footer.count && id.startsWith(cfg.footer.prefix)) {
    return cfg.footer.prefix + padPage(id.slice(cfg.footer.prefix.length));
  }
  return id;
}

/** 某本字典的首个合法页码（header → content → footer）。 */
export function getFirstPageId(repo?: string | null): string {
  const cfg = pageConfig(repo);
  if (cfg.header.count > 0) return `${cfg.header.prefix}${padPage(1)}`;
  if (cfg.content.count > 0) return padPage(1);
  if (cfg.footer.count > 0) return `${cfg.footer.prefix}${padPage(1)}`;
  return "0001";
}

/** 某本字典的末页页码。 */
export function getLastPageId(repo?: string | null): string {
  const cfg = pageConfig(repo);
  if (cfg.footer.count > 0) return `${cfg.footer.prefix}${padPage(cfg.footer.count)}`;
  if (cfg.content.count > 0) return padPage(cfg.content.count);
  if (cfg.header.count > 0) return `${cfg.header.prefix}${padPage(cfg.header.count)}`;
  return "0001";
}

/** 跨 header/content/footer 的总页数。 */
export function totalPages(repo?: string | null): number {
  const cfg = pageConfig(repo);
  return cfg.header.count + cfg.content.count + cfg.footer.count;
}

/** 是否为内容（纯数字）页。 */
export function isContentPage(page: string): boolean {
  return /^\d+$/.test(String(page));
}

/** 按偏移量翻页，可跨越分组边界（header→content→footer）。 */
export function shiftPage(current: string, offset = 1, repo?: string | null): string {
  const cfg = pageConfig(repo);
  const headerCount = cfg.header.count;
  const contentCount = cfg.content.count;
  const footerCount = cfg.footer.count;
  const mainCount = headerCount + contentCount;
  const totalCount = mainCount + footerCount;

  // 解析当前页所属分组前缀（同时校验前缀非空，避免空字符串匹配所有页）
  let group: string;
  if (cfg.header.count && cfg.header.prefix && current.startsWith(cfg.header.prefix)) group = cfg.header.prefix;
  else if (cfg.footer.count && cfg.footer.prefix && current.startsWith(cfg.footer.prefix)) group = cfg.footer.prefix;
  else group = cfg.content.prefix;

  const num = parseInt(current.slice(group.length), 10);
  if (Number.isNaN(num)) return current;

  // 计算全局绝对索引
  let idx: number;
  if (group === cfg.header.prefix) idx = num - 1;
  else if (group === cfg.footer.prefix) idx = mainCount + num - 1;
  else idx = headerCount + num - 1;

  const target = idx + offset;
  if (target < 0 || target >= totalCount) return current;

  // 落在哪个分组就按对应前缀输出
  if (target < headerCount) return `${cfg.header.prefix}${padPage(target + 1)}`;
  if (target < mainCount) return padPage(target - headerCount + 1);
  return `${cfg.footer.prefix}${padPage(target - mainCount + 1)}`;
}

/** 向前/向后跳 N 页（shiftPage 的别名）。 */
export function jumpPages(current: string, n: number, repo?: string | null): string {
  return shiftPage(current, n, repo);
}
