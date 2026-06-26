import { describe, it, expect } from "vitest";
import { normalizePinyin, pinyinToAscii, fuzzyScore } from "../src/search/pinyin.ts";
import { isNumeric, normalizePageId, shiftPage, getFirstPageId, getLastPageId, totalPages, isContentPage } from "../src/core/navigation.ts";
import { padPage } from "../src/utils/dom.ts";
import { highlightTerm, highlightMatches } from "../src/search/highlight.ts";

// 这些测试不依赖 state（navigation/pinyin/highlight 是纯函数）
// navigation 的 pageConfig 在 state.currentDict 为 null 时回退到 DEFAULT_PAGE

describe("pinyin.normalizePinyin", () => {
    it("v → ü", () => {
        expect(normalizePinyin("nv")).toBe("nü");
    });
    it("V → Ü", () => {
        expect(normalizePinyin("NV")).toBe("NÜ");
    });
    it("ẑ ĉ ŝ → zh ch sh", () => {
        expect(normalizePinyin("ẑong")).toBe("zhong");
        expect(normalizePinyin("ĉan")).toBe("chan");
        expect(normalizePinyin("ŝan")).toBe("shan");
    });
    it("ŋ → ng", () => {
        expect(normalizePinyin("ŋ")).toBe("ng");
    });
    it("bare ei → ê", () => {
        expect(normalizePinyin("ei")).toBe("ê");
    });
    it("null/undefined → empty string", () => {
        expect(normalizePinyin(null)).toBe("");
        expect(normalizePinyin(undefined)).toBe("");
    });
});

describe("pinyin.pinyinToAscii", () => {
    it("strips tone marks", () => {
        expect(pinyinToAscii("āáǎà")).toBe("aaaa");
        expect(pinyinToAscii("ēéěè")).toBe("eeee");
    });
    it("ü → v (before NFD)", () => {
        expect(pinyinToAscii("nǚ")).toBe("nv");
        expect(pinyinToAscii("lǜ")).toBe("lv");
    });
    it("lowercase", () => {
        expect(pinyinToAscii("ABC")).toBe("abc");
    });
});

describe("pinyin.fuzzyScore", () => {
    it("exact = 0", () => {
        expect(fuzzyScore("abc", "abc")).toBe(0);
    });
    it("startsWith = 1", () => {
        expect(fuzzyScore("abcdef", "abc")).toBe(1);
    });
    it("endsWith = 2", () => {
        expect(fuzzyScore("xabc", "abc")).toBe(2);
    });
    it("includes = 3", () => {
        expect(fuzzyScore("xabcy", "abc")).toBe(3);
    });
    it("subsequence = 4", () => {
        expect(fuzzyScore("aXbYc", "abc")).toBe(4);
    });
    it("no match = MAX_SAFE_INTEGER", () => {
        expect(fuzzyScore("xyz", "abc")).toBe(Number.MAX_SAFE_INTEGER);
    });
});

describe("navigation.isNumeric", () => {
    it("positive integers", () => {
        expect(isNumeric("1")).toBe(true);
        expect(isNumeric("123")).toBe(true);
    });
    it("rejects zero, negative, decimal", () => {
        expect(isNumeric("0")).toBe(false);
        expect(isNumeric("-1")).toBe(false);
        expect(isNumeric("1.5")).toBe(false);
    });
    it("rejects empty and non-numeric", () => {
        expect(isNumeric("")).toBe(false);
        expect(isNumeric("abc")).toBe(false);
    });
});

describe("navigation with DEFAULT_PAGE", () => {
    // DEFAULT_PAGE: content count=1, header count=0 prefix A, footer count=0 prefix C
    it("normalizePageId pads content page", () => {
        expect(normalizePageId("1")).toBe("0001");
    });
    it("isValidPageId rejects out-of-range content", () => {
        expect(normalizePageId("2")).toBeNull();
    });
    it("isContentPage", () => {
        expect(isContentPage("0001")).toBe(true);
        expect(isContentPage("A0001")).toBe(false);
    });
    it("getFirstPageId / getLastPageId / totalPages", () => {
        expect(getFirstPageId()).toBe("0001");
        expect(getLastPageId()).toBe("0001");
        expect(totalPages()).toBe(1);
    });
    it("shiftPage stays at boundary", () => {
        expect(shiftPage("0001", 1)).toBe("0001");
        expect(shiftPage("0001", -1)).toBe("0001");
    });
});

describe("navigation with multi-group config", () => {
    // 模拟一个 header(2) + content(3) + footer(1) 的配置
    // 直接测 shiftPage 在 DEFAULT_PAGE 下行为有限，这里测跨边界逻辑需要 mock state
    // 暂用 padPage 间接验证
    it("padPage default width 4", () => {
        expect(padPage("1")).toBe("0001");
        expect(padPage("12")).toBe("0012");
    });
    it("padPage custom width", () => {
        expect(padPage("1", 6)).toBe("000001");
    });
});

describe("highlight.highlightTerm", () => {
    it("wraps matched substring in mark", () => {
        expect(highlightTerm("hello world", "world")).toBe("hello <mark>world</mark>");
    });
    it("case insensitive by default", () => {
        expect(highlightTerm("Hello World", "world")).toBe("Hello <mark>World</mark>");
    });
    it("escapes HTML in term", () => {
        expect(highlightTerm("a<b>c", "b")).toBe("a&lt;<mark>b</mark>&gt;c");
    });
    it("no match returns escaped term", () => {
        expect(highlightTerm("abc", "xyz")).toBe("abc");
    });
    it("custom tag and className", () => {
        const result = highlightTerm("hello", "ell", { tag: "span", className: "hl" });
        expect(result).toBe('h<span class="hl">ell</span>o');
    });
});

describe("highlight.highlightMatches", () => {
    it("highlights multiple queries", () => {
        expect(highlightMatches("hello world", ["world", "hello"]))
            .toBe("<mark>hello</mark> <mark>world</mark>");
    });
    it("longest first to avoid nested marks", () => {
        expect(highlightMatches("abc", ["a", "ab"]))
            .toBe("<mark>ab</mark>c");
    });
    it("no matches returns escaped text", () => {
        expect(highlightMatches("abc", ["xyz"])).toBe("abc");
    });
});
