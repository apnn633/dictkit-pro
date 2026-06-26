// ============================================================
// utils/store.ts — localStorage wrapper with namespace + JSON
// ============================================================

const PREFIX = "dictkit:v3:";
/** M8：连续写入失败的最小间隔（避免反复 toast 打扰）。 */
const NOTIFY_THROTTLE_MS = 10_000;
let lastNotifyTs = 0;

/** Read a JSON value, returning fallback on miss/parse error. */
export function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    // H2：过滤危险键，避免原型污染（__proto__/constructor/prototype）
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const key of ["__proto__", "constructor", "prototype"]) {
        if (key in parsed) delete parsed[key];
      }
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a JSON value.
 * M8：写入失败时（如 quota 超限 / 隐私模式）派发 `dictkit:store-error` 事件，
 * 让 UI 层（main.ts）订阅后弹 toast 通知用户，并仍返回 false 让调用方感知失败。
 */
export function set(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("localStorage write failed:", key, err);
    notifyStoreError(key, err);
    return false;
  }
}

/** 节流派发写入失败事件，避免短时间内重复 toast。 */
function notifyStoreError(key: string, err: unknown): void {
  const now = Date.now();
  if (now - lastNotifyTs < NOTIFY_THROTTLE_MS) return;
  lastNotifyTs = now;
  try {
    window.dispatchEvent(
      new CustomEvent("dictkit:store-error", { detail: { key, error: String(err) } }),
    );
  } catch {
    /* 派发失败也无能为力，保持静默 */
  }
}

/** Remove a key. */
export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Migrate a value from the v2 namespace if v3 key is absent. */
export function migrate<T>(oldKey: string, newKey: string): T | null {
  try {
    const existing = localStorage.getItem(PREFIX + newKey);
    if (existing != null) return null;
    const legacy = localStorage.getItem("dictkit:v2:" + oldKey);
    if (legacy == null) return null;
    let value: unknown;
    try {
      value = JSON.parse(legacy);
    } catch {
      // L13：legacy 非合法 JSON，直接移除旧键，不写入错误值；
      // 调用方 get(newKey) 时会 fallback 到默认值
      try { localStorage.removeItem("dictkit:v2:" + oldKey); } catch { /* ignore */ }
      return null;
    }
    set(newKey, value);
    return value as T;
  } catch {
    return null;
  }
}
