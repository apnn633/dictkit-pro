import { describe, it, expect, beforeEach } from "vitest";
import { get, set, remove, migrate } from "../src/utils/store.ts";
import { stripLeadingZeros } from "../src/utils/url.ts";

// jsdom 提供 localStorage
describe("store", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("set/get roundtrip", () => {
        set("key1", { a: 1, b: "two" });
        expect(get("key1", null)).toEqual({ a: 1, b: "two" });
    });

    it("get returns fallback on miss", () => {
        expect(get("missing", "default")).toBe("default");
        expect(get<number>("missing", 42)).toBe(42);
    });

    it("get returns fallback on parse error", () => {
        localStorage.setItem("dictkit:v3:broken", "{invalid json");
        expect(get("broken", "fallback")).toBe("fallback");
    });

    it("remove deletes key", () => {
        set("temp", "value");
        remove("temp");
        expect(get("temp", null)).toBeNull();
    });

    it("uses v3 prefix", () => {
        set("k", "v");
        expect(localStorage.getItem("dictkit:v3:k")).toBe('"v"');
    });

    it("migrate copies from v2 namespace", () => {
        localStorage.setItem("dictkit:v2:oldKey", '"migrated"');
        const result = migrate<string>("oldKey", "newKey");
        expect(result).toBe("migrated");
        expect(get("newKey", "")).toBe("migrated");
    });

    it("migrate returns null if v3 key already exists", () => {
        set("newKey", "existing");
        localStorage.setItem("dictkit:v2:oldKey", '"ignored"');
        expect(migrate<string>("oldKey", "newKey")).toBeNull();
        expect(get("newKey", "")).toBe("existing");
    });

    it("migrate returns null if v2 key absent", () => {
        expect(migrate<string>("absent", "newKey")).toBeNull();
    });
});

describe("url helpers", () => {
    it("stripLeadingZeros removes leading zeros, keeps prefix", () => {
        expect(stripLeadingZeros("0001")).toBe("1");
        expect(stripLeadingZeros("A0001")).toBe("A1");
        expect(stripLeadingZeros("C0042")).toBe("C42");
    });
});
