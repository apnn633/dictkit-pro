// ============================================================
// search/pinyin.ts — 拼音归一化（v→ü, ẑĉŝ→zh/ch/sh）
// ============================================================

const PINYIN_MAP: Record<string, string> = {
  v: "ü",
  V: "Ü",
  ẑ: "zh",
  ĉ: "ch",
  ŝ: "sh",
  Ŋ: "ng",
  ŋ: "ng",
};

const KEYS = Object.keys(PINYIN_MAP)
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const REGEXP = new RegExp(KEYS, "gi");

/** 将输入的拼音简写（v、ẑ ĉ ŝ）转换为完整形式。 */
export function normalizePinyin(input: string | null | undefined): string {
  if (input == null) return "";
  const fixed = String(input).replace(REGEXP, m => PINYIN_MAP[m] || m);
  // 旧约定：某些字典里单独的 "ei" 表示 "ê"
  return fixed === "ei" ? "ê" : fixed;
}

/** 转成纯 ASCII 拼音用于宽松比较（去除声调符号）。 */
export function pinyinToAscii(input: string): string {
  return String(input)
    .toLowerCase()
    // 在 NFD 分解前先把 ü 及其带声调的变体（ǖǘǚǜ）替换为 v，
    // 否则 NFD 会把它们拆成 u + 组合符号，丢失变音信息
    .replace(/[üǖǘǚǜ]/g, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** 计算简单的模糊匹配分数（越小越匹配）。 */
export function fuzzyScore(term: string, query: string): number {
  const t = String(term);
  const q = String(query);
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.endsWith(q)) return 2;
  if (t.includes(q)) return 3;

  // 子序列匹配，用于模糊输入
  let ti = 0;
  let qi = 0;
  for (; qi < q.length; qi++) {
    ti = t.indexOf(q[qi], ti);
    if (ti === -1) return Number.MAX_SAFE_INTEGER;
    ti++;
  }
  // query 必须被完整消费才算匹配（防止 query 比 term 长时假阳性）
  return qi === q.length ? 4 : Number.MAX_SAFE_INTEGER;
}
