// ============================================================
// ui/settings.ts — 设置面板（字体 / 主题 / 数据源 / 版式）
// ============================================================
import { byId, h } from "../utils/dom.ts";
import { state } from "../core/state.ts";
import * as store from "../utils/store.ts";
import { clearProxyCache } from "../core/data-loader.ts";
import { clearAllImageCache } from "../core/image-loader.ts";
import { toast } from "./toast.ts";
import { t } from "./i18n.ts";
import { trimHistoryToLimit, renderHistory } from "./history.ts";

// viewer 通过动态 import 加载以打破循环依赖（字面量路径，Vite 可静态分析）

let initialized = false;

/** 持久化键名。 */
const KEYS = {
  font: "fontId",
  customFont: "customFont",
  theme: "themeId",
  customTheme: "customTheme",
  dataSource: "dataSourceId",
  spread: "spreadMode",
  fontSize: "fontSize",
  zoom: "zoomLevel",
  fitWidth: "fitWidth",
  historyLimit: "historyLimit",
} as const;

/** 应用字体：叠加自定义字体到字体栈前部。 */
function applyFont(fontId: string): void {
  const font = state.fonts.find(f => f.id === fontId) || state.fonts[0];
  if (!font) return;
  const custom = store.get<{ name: string; url: string } | null>(KEYS.customFont, null);
  const stack = custom ? `'${cssEscapeString(custom.name)}', ${font.stack}` : font.stack;
  document.documentElement.style.setProperty("--font", stack);
  // 注入自定义字体 @font-face（仅一次）
  if (custom) ensureCustomFontFace(custom.name, custom.url);
}

/**
 * M14：转义 CSS 标识符中可能破坏规则的字符（引号、反斜杠、换行）。
 * 自定义字体名来自用户上传的文件名，未转义会让 @font-face / font-family 解析失败。
 * L1：仅用正则替换，避免对已转义结果再调用 CSS.escape 造成双重转义。
 */
function cssEscapeString(s: string): string {
  return String(s).replace(/['"\\\n\r]/g, ch => `\\${ch}`);
}

/** 注入或更新自定义字体的 @font-face（每次上传都覆盖，确保二次上传生效）。 */
function ensureCustomFontFace(name: string, url: string): void {
  const id = "custom-font-face";
  const format = guessFontFormat(url);
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  // M14：name 与 url 均做 CSS 安全转义，避免注入。
  // url 这里是 FileReader 产生的 data: URL，但仍走 escape 兜底防意外字符。
  style.textContent = `@font-face { font-family: '${cssEscapeString(name)}'; src: url('${cssEscapeString(url)}') format('${format}'); }`;
}

/** 根据数据 URL 推断字体格式。 */
function guessFontFormat(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("woff2")) return "woff2";
  if (lower.includes("woff")) return "woff";
  if (lower.includes("opentype") || lower.includes(".otf")) return "opentype";
  return "truetype";
}

/** 应用主题：写入 data-theme 属性。 */
function applyTheme(themeId: string): void {
  document.documentElement.setAttribute("data-theme", themeId);
}

/** 应用版式变更：刷新图片。失败时回滚 state 以保持一致性。 */
async function applySpreadChange(spread: boolean): Promise<void> {
  const old = state.isSpreadMode;
  state.isSpreadMode = spread;
  try {
    const mod = await import("../viewer/viewer.ts");
    await mod.showImage();
  } catch (err) {
    state.isSpreadMode = old;
    throw err;
  }
}

/** 同步应用适应模式属性到 DOM 与 state（state.fitMode 为单一真源）。 */
export function applyFitAttr(fitWidth: boolean): void {
  state.fitMode = fitWidth ? "width" : "fit";
  const container = byId("resultContainer");
  if (!container) return;
  if (fitWidth) container.setAttribute("data-fit", "width");
  else container.removeAttribute("data-fit");
  // 同步工具栏按钮的按压态
  const toolbarBtn = byId("fitWidth");
  if (toolbarBtn) toolbarBtn.setAttribute("aria-pressed", fitWidth ? "true" : "false");
}

/** 应用适应模式变更：写入属性 + 持久化，不强制重置缩放。 */
export async function applyFitChange(fitWidth: boolean): Promise<void> {
  applyFitAttr(fitWidth);
  store.set(KEYS.fitWidth, fitWidth);
  // 同步设置面板开关状态（若面板已渲染）
  const toggle = byId<HTMLInputElement>("fitWidthToggle");
  if (toggle && toggle.checked !== fitWidth) {
    toggle.checked = fitWidth;
    const label = byId("fitModeLabel");
    if (label) label.textContent = fitWidth ? t("fitWidth") : t("fitHeight");
  }
}

/** 切换适应宽度模式（供工具栏按钮调用）。 */
export async function toggleFitWidth(): Promise<void> {
  await applyFitChange(state.fitMode !== "width");
}

/** 构造带标签的一行设置项。 */
function row(label: string, control: HTMLElement): HTMLElement {
  // 关联 label 与 control：有 id 时设置 for 属性，满足无障碍审计
  // （Form elements must have labels / No label associated with a form field）。
  const labelEl = h("label", { class: "settings-label" }, [label]);
  if (control.id) labelEl.setAttribute("for", control.id);
  return h("div", { class: "settings-row" }, [
    labelEl,
    control,
  ]);
}

/** 构建设置面板内容并绑定事件。 */
function buildPanel(): void {
  const panel = byId("settingsPanel");
  if (!panel) return;
  panel.innerHTML = "";

  // 字体选择
  const fontSelect = h("select", { id: "fontSelect" }, state.fonts.map(f =>
    h("option", { value: f.id }, [f.name]),
  ));
  fontSelect.value = store.get<string>(KEYS.font, state.defaults.fontId || "");
  fontSelect.addEventListener("change", () => {
    store.set(KEYS.font, fontSelect.value);
    applyFont(fontSelect.value);
  });

  // 自定义字体上传
  const fontInput = h("input", { type: "file", accept: ".ttf,.otf,.woff,.woff2", id: "customFontInput" });
  fontInput.addEventListener("change", () => {
    const file = fontInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!store.set(KEYS.customFont, { name: file.name, url: dataUrl })) {
        toast(t("storeWriteFailed"), "warn");
        return;
      }
      applyFont(store.get<string>(KEYS.font, state.defaults.fontId || ""));
      toast(t("fontUploaded"), "success");
    };
    reader.readAsDataURL(file);
  });

  // 字号范围
  const sizeRange = h("input", { type: "range", min: "80", max: "150", step: "1", id: "fontSizeRange" });
  sizeRange.value = String(store.get<number>(KEYS.fontSize, 100));
  sizeRange.addEventListener("input", () => {
    const size = Number(sizeRange.value);
    store.set(KEYS.fontSize, size);
    document.documentElement.style.setProperty("--font-size", `${size}%`);
  });

  // 主题选择
  const themeSelect = h("select", { id: "themeSelect" }, [
    h("option", { value: "auto" }, [t("themeAuto")]),
    h("option", { value: "light" }, [t("themeLight")]),
    h("option", { value: "dark" }, [t("themeDark")]),
    h("option", { value: "sepia" }, [t("themeSepia")]),
    h("option", { value: "contrast" }, [t("themeContrast")]),
  ]);
  themeSelect.value = store.get<string>(KEYS.theme, state.defaults.themeId || "auto");
  themeSelect.addEventListener("change", () => {
    store.set(KEYS.theme, themeSelect.value);
    applyTheme(themeSelect.value);
  });

  // 自定义主题色
  const colorInput = h("input", { type: "color", id: "customThemeColor" });
  colorInput.value = store.get<string>(KEYS.customTheme, "#ec0015");
  colorInput.addEventListener("input", () => {
    store.set(KEYS.customTheme, colorInput.value);
    document.documentElement.style.setProperty("--accent", colorInput.value);
  });

  // 数据源选择
  const dsOptions = [h("option", { value: "auto" }, [t("dsAuto")])].concat(
    state.dataSources.map(ds => h("option", { value: ds.id }, [ds.name])),
  );
  const dsSelect = h("select", { id: "dataSourceSelect" }, dsOptions);
  dsSelect.value = store.get<string>(KEYS.dataSource, state.defaults.dataSourceId || "auto");
  dsSelect.addEventListener("change", () => {
    store.set(KEYS.dataSource, dsSelect.value);
    state.selectedDataSourceId = dsSelect.value;
    clearProxyCache();
  });

  // 版式（单页 / 双页）
  const spreadSelect = h("select", { id: "spreadModeSelect" }, [
    h("option", { value: "0" }, [t("layoutSingle")]),
    h("option", { value: "1" }, [t("layoutSpread")]),
  ]);
  spreadSelect.value = store.get<boolean>(KEYS.spread, state.defaults.spreadMode || false) ? "1" : "0";
  spreadSelect.addEventListener("change", () => {
    const spread = spreadSelect.value === "1";
    store.set(KEYS.spread, spread);
    void applySpreadChange(spread).catch(err => console.warn("applySpreadChange failed:", err));
  });

  // 图片适应（适合高度 / 适合宽度）开关
  const fitToggle = h("input", { type: "checkbox", id: "fitWidthToggle" });
  fitToggle.checked = store.get<boolean>(KEYS.fitWidth, false);
  const fitSwitch = h("label", { class: "settings-switch", for: "fitWidthToggle" }, [
    fitToggle,
    h("span", { class: "switch-track" }),
  ]);
  const fitLabel = h("span", { class: "settings-value", id: "fitModeLabel" }, [
    fitToggle.checked ? t("fitWidth") : t("fitHeight"),
  ]);
  fitToggle.addEventListener("change", () => {
    void applyFitChange(fitToggle.checked).catch(err => console.warn("applyFitChange failed:", err));
  });
  const fitRow = h("div", { class: "settings-row" }, [
    h("label", { class: "settings-label", for: "fitWidthToggle" }, [t("setFit")]),
    fitSwitch,
    fitLabel,
  ]);

  // 历史记录上限（超过此条数自动删除最旧记录；0 表示用默认值）
  const historyLimitInput = h("input", {
    type: "number",
    min: "0",
    max: "10000",
    step: "1",
    id: "historyLimitInput",
    class: "settings-number-input",
  });
  historyLimitInput.value = String(store.get<number>(KEYS.historyLimit, 0));
  historyLimitInput.addEventListener("change", () => {
    const raw = Number(historyLimitInput.value);
    const val = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.floor(raw), 10000) : 0;
    historyLimitInput.value = String(val);
    store.set(KEYS.historyLimit, val);
    // 立即按新上限裁剪已存在的阅读历史，并刷新历史侧栏（若正打开）
    const removed = trimHistoryToLimit();
    if (removed > 0) renderHistory();
    toast(t("historyLimitHint"), "info");
  });
  const historyLimitRow = h("div", { class: "settings-row settings-row-stack" }, [
    h("label", { class: "settings-label", for: "historyLimitInput" }, [t("setHistoryLimit")]),
    historyLimitInput,
    h("span", { class: "settings-hint" }, [t("historyLimitHint")]),
  ]);

  // 清理缓存：SW 持久化缓存（dictkit-images / dictkit-metadata）+ 全部图片内存缓存 + 代理健康状态
  const clearCacheBtn = h("button", { type: "button", class: "settings-action-btn", id: "clearCacheBtn" }, [t("setClearCache")]);
  clearCacheBtn.addEventListener("click", async () => {
    try {
      // 1) SW 持久化缓存（图片 + 元数据）
      if ("caches" in window) {
        await Promise.all([
          caches.delete("dictkit-images"),
          caches.delete("dictkit-metadata"),
        ]);
      }
      // 2) 内存缓存（所有词典的图片 URL 缓存、在飞请求、熔断记录）
      clearAllImageCache();
      // 3) 代理健康状态 + JSON 路径熔断
      clearProxyCache();
      toast(t("cacheCleared"), "success");
      // 稍候刷新以让当前页图片重新加载
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.warn("clear cache failed:", err);
      toast(t("cacheCleared"), "info");
    }
  });
  const clearCacheRow = h("div", { class: "settings-row settings-row-stack" }, [
    h("label", { class: "settings-label" }, [t("setClearCache")]),
    clearCacheBtn,
    h("span", { class: "settings-hint" }, [t("clearCacheHint")]),
  ]);

  panel.append(
    row(t("setFont"), fontSelect),
    row(t("setCustomFont"), fontInput),
    row(t("setFontSize"), sizeRange),
    row(t("setTheme"), themeSelect),
    row(t("setThemeColor"), colorInput),
    row(t("setDataSource"), dsSelect),
    row(t("setLayout"), spreadSelect),
    fitRow,
    historyLimitRow,
    clearCacheRow,
  );
}

/** 绑定设置开关：点击切换、点击外部关闭。 */
function wireToggle(): void {
  const toggle = byId("settingsToggle");
  const panel = byId("settingsPanel");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
    const open = panel.classList.toggle("active");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (e: MouseEvent) => {
    if (!panel.classList.contains("active")) return;
    const target = e.target as Node;
    if (panel.contains(target) || toggle.contains(target)) return;
    panel.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
  });
}

/** 初始化设置面板。 */
export function initSettings(): void {
  if (initialized) return;
  initialized = true;
  // 迁移 v2 命名空间下的旧键
  store.migrate("fontId", KEYS.font);
  store.migrate("themeId", KEYS.theme);
  store.migrate("dataSourceId", KEYS.dataSource);
  store.migrate("spreadMode", KEYS.spread);
  store.migrate("fontSize", KEYS.fontSize);
  store.migrate("zoomLevel", KEYS.zoom);

  buildPanel();
  applyFont(store.get<string>(KEYS.font, state.defaults.fontId || ""));
  applyTheme(store.get<string>(KEYS.theme, state.defaults.themeId || "auto"));

  // 应用初始字号
  const fontSize = store.get<number>(KEYS.fontSize, 100);
  document.documentElement.style.setProperty("--font-size", `${fontSize}%`);

  // 应用初始自定义主题色
  const customColor = store.get<string>(KEYS.customTheme, "");
  if (customColor) document.documentElement.style.setProperty("--accent", customColor);

  // 应用初始图片适应模式（仅同步属性，不重置缩放）
  applyFitAttr(store.get<boolean>(KEYS.fitWidth, false));

  wireToggle();

  // 跟随系统主题变化（仅当主题为 auto 时）
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    const theme = store.get<string>(KEYS.theme, state.defaults.themeId || "auto");
    if (theme === "auto") applyTheme("auto");
  });

  // 语言切换时重建面板，使动态生成的选项标签同步翻译
  window.addEventListener("dictkit:langchange", () => {
    const wasOpen = byId("settingsPanel")?.classList.contains("active") ?? false;
    buildPanel();
    if (wasOpen) byId("settingsPanel")?.classList.add("active");
  });
}
