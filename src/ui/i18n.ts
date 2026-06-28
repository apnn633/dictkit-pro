// ============================================================
// ui/i18n.ts — 极简国际化（中 / 英）
// 通过 data-i18n / data-i18n-placeholder / data-i18n-title /
// data-i18n-aria-label 属性标记需翻译的 DOM 节点，applyI18n() 统一刷新。
// ============================================================
import { byId, $$ } from "../utils/dom.ts";
import * as store from "../utils/store.ts";
import { toast } from "./toast.ts";

type Lang = "zh" | "en";

const translations: Record<Lang, Record<string, string>> = {
  zh: {
    appTitle: "汉语字典词典在线版",
    docTitle: "汉语字典词典在线版",
    selectDict: "选择词典",
    searchPlaceholder: "拼音、字词或页码……",
    search: "搜索",
    filterAll: "全部",
    filterPinyin: "拼音",
    filterChars: "单字",
    filterWords: "词语",
    settings: "设置",
    notes: "批注笔记",
    history: "历史记录",
    bookmarks: "书签收藏",
    compare: "对比模式",
    fullscreen: "全屏模式",
    pinyinTip: "拼音提示",
    toc: "词典目录",
    langToggle: "语言 / Language",
    tocTitle: "词典简明目录",
    historyTitle: "阅读历史",
    bookmarkTitle: "我的书签",
    notesTitle: "批注笔记",
    addBookmark: "+ 收藏",
    addNote: "+ 笔记",
    clear: "清空",
    export: "导出",
    close: "关闭",
    thumbToggle: "缩略图导航",
    prev: "上一页",
    next: "下一页",
    zoomIn: "放大 (+)",
    zoomOut: "缩小 (-)",
    reset: "重置缩放 (0)",
    fitWidth: "适合宽度",
    rotate: "旋转 (R)",
    loading: "加载中……",
    noResults: "未找到",
    bookmarked: "已收藏",
    bookmarkAdded: "已加入书签",
    noBookmarks: "暂无书签",
    delete: "删除",
    deleteBookmark: "删除书签",
    noToc: "该词典暂无目录",
    pageN: "第 {0} 页",
    disclaimer: "本工具仅为阅读外壳，不存储/不分发词典数据，版权归相应出版社与编者所有；仅供个人学习研究。",
    historyCleared: "已清空阅读历史",
    exitCompare: "已退出对照模式",
    enterCompare: "已开启对照模式",
    switchedZh: "已切换为中文",
    switchedEn: "Switched to English",
    // 设置面板
    setFont: "字体",
    setCustomFont: "自定义字体",
    setFontSize: "字号",
    setTheme: "主题",
    setThemeColor: "主题色",
    setDataSource: "数据源",
    setLayout: "版式",
    themeAuto: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    themeSepia: "护眼",
    themeContrast: "高对比",
    dsAuto: "自动",
    layoutSingle: "单页",
    layoutSpread: "双页",
    fontUploaded: "字体已上传",
    setFit: "图片适应",
    fitHeight: "适合高度",
    loadFailed: "图片加载失败，请切换数据来源或稍后重试",
    noHistory: "暂无阅读历史",
    noNotes: "暂无笔记",
    noteAdded: "已添加笔记",
    noteDeleted: "已删除笔记",
    noteEdit: "编辑",
    noteDelete: "删除",
    noteEditPrompt: "编辑笔记",
    noteAddPrompt: "输入笔记内容",
    noCompareDict: "没有可对照的词典",
    pickCompare: "选择对照词典",
    confirm: "确定",
    cancel: "取消",
    storeWriteFailed: "本地存储写入失败，部分设置可能无法保存（可能是隐私模式或存储已满）",
    searchTypePinyin: "拼音",
    searchTypeChars: "单字",
    searchTypeWords: "词语",
    searchTypeOther: "其他",
    noDictConfig: "未找到词典配置",
    initFailed: "初始化失败，请检查数据来源",
    pageParamInvalid: "页码参数格式异常或超出范围",
    setHistoryLimit: "历史上限",
    historyLimitHint: "超过此条数自动删除最旧记录（0=用默认值）",
    setClearCache: "清理缓存",
    clearCacheHint: "清除图片缓存（含离线缓存）与内存缓存，不影响设置/书签/历史",
    cacheCleared: "缓存已清理，正在刷新……",
  },
  en: {
    appTitle: "Chinese Dictionary Online",
    docTitle: "Chinese Dictionary Online",
    selectDict: "Select dictionary",
    searchPlaceholder: "Pinyin, word or page…",
    search: "Search",
    filterAll: "All",
    filterPinyin: "Pinyin",
    filterChars: "Char",
    filterWords: "Word",
    settings: "Settings",
    notes: "Notes",
    history: "History",
    bookmarks: "Bookmarks",
    compare: "Compare",
    fullscreen: "Fullscreen",
    pinyinTip: "Pinyin Tip",
    toc: "Contents",
    langToggle: "Language / 语言",
    tocTitle: "Contents",
    historyTitle: "Reading History",
    bookmarkTitle: "My Bookmarks",
    notesTitle: "Notes",
    addBookmark: "+ Bookmark",
    addNote: "+ Note",
    clear: "Clear",
    export: "Export",
    close: "Close",
    thumbToggle: "Thumbnails",
    prev: "Previous",
    next: "Next",
    zoomIn: "Zoom In (+)",
    zoomOut: "Zoom Out (-)",
    reset: "Reset Zoom (0)",
    fitWidth: "Fit Width",
    rotate: "Rotate (R)",
    loading: "Loading…",
    noResults: "No results",
    bookmarked: "Bookmarked",
    bookmarkAdded: "Bookmark added",
    noBookmarks: "No bookmarks",
    delete: "Delete",
    deleteBookmark: "Delete bookmark",
    noToc: "No table of contents for this dictionary",
    pageN: "Page {0}",
    disclaimer: "This tool is a reading shell only. It does not store or distribute dictionary data. Copyrights belong to respective publishers and authors. For personal study and research only.",
    historyCleared: "History cleared",
    exitCompare: "Exited compare mode",
    enterCompare: "Compare mode on",
    switchedZh: "已切换为中文",
    switchedEn: "Switched to English",
    // Settings panel
    setFont: "Font",
    setCustomFont: "Custom Font",
    setFontSize: "Font Size",
    setTheme: "Theme",
    setThemeColor: "Accent",
    setDataSource: "Data Source",
    setLayout: "Layout",
    themeAuto: "System",
    themeLight: "Light",
    themeDark: "Dark",
    themeSepia: "Sepia",
    themeContrast: "Contrast",
    dsAuto: "Auto",
    layoutSingle: "Single",
    layoutSpread: "Spread",
    fontUploaded: "Font uploaded",
    setFit: "Image Fit",
    fitHeight: "Fit Height",
    loadFailed: "Image load failed. Try another data source or retry later.",
    noHistory: "No history yet",
    noNotes: "No notes yet",
    noteAdded: "Note added",
    noteDeleted: "Note deleted",
    noteEdit: "Edit",
    noteDelete: "Delete",
    noteEditPrompt: "Edit note",
    noteAddPrompt: "Enter note content",
    noCompareDict: "No dictionaries to compare",
    pickCompare: "Pick a dictionary to compare",
    confirm: "OK",
    cancel: "Cancel",
    storeWriteFailed: "Local storage write failed. Some settings may not persist (private mode or quota exceeded).",
    searchTypePinyin: "Pinyin",
    searchTypeChars: "Char",
    searchTypeWords: "Word",
    searchTypeOther: "Other",
    noDictConfig: "No dictionary configuration found",
    initFailed: "Initialization failed. Please check data sources.",
    pageParamInvalid: "Page parameter is malformed or out of range",
    setHistoryLimit: "History Limit",
    historyLimitHint: "Auto-deletes oldest entries beyond this count (0=use default)",
    setClearCache: "Clear Cache",
    clearCacheHint: "Clears image cache (incl. offline) and in-memory cache. Settings/bookmarks/history are kept.",
    cacheCleared: "Cache cleared, refreshing…",
  },
};

let currentLang: Lang = "zh";
let initialized = false;

/**
 * 翻译查找，支持 {0} {1} 形式的占位符。
 * 找不到时回退到中文，再回退到键名本身。
 */
export function t(key: string, ...args: unknown[]): string {
  const table = translations[currentLang] || translations.zh;
  let str = table[key] ?? translations.zh[key] ?? key;
  // M1：单次正则替换，避免多次 replaceAll 在占位符文本互相包含时污染（如 {1} 替换出 {0}）
  str = str.replace(/\{(\d+)\}/g, (_, n) => {
    const idx = Number(n);
    return idx < args.length ? String(args[idx]) : `{${n}}`;
  });
  return str;
}

/** 当前语言。 */
export function getCurrentLang(): string {
  return currentLang;
}

/**
 * 遍历带 data-i18n* 属性的 DOM 节点并刷新其文本/属性。
 * 切换语言后调用即可让静态 HTML 文本同步更新。
 */
export function applyI18n(): void {
  // M2：合并为一次查询，避免 4 次全文档遍历
  // M19：placeholder 在赋值前显式判断元素类型，避免对非输入元素写入无效属性。
  for (const el of $$<HTMLElement>("[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]")) {
    if (el.dataset.i18n) el.textContent = t(el.dataset.i18n);
    if (el.dataset.i18nPlaceholder && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    }
    if (el.dataset.i18nTitle) el.title = t(el.dataset.i18nTitle);
    if (el.dataset.i18nAriaLabel) el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  }
  // 同步 <title>
  document.title = t("docTitle");
}

/**
 * M10：把搜索结果来源 key（pinyin/chars/words/toc）翻译成展示标签。
 * 用于搜索建议与历史项的"分类"列。
 */
export function searchTypeLabel(key: string): string {
  switch (key) {
    case "pinyin": return t("searchTypePinyin");
    case "chars": return t("searchTypeChars");
    case "words": return t("searchTypeWords");
    case "toc": return t("toc");
    default: return t("searchTypeOther");
  }
}

/** 切换语言、持久化并刷新 DOM 文本。 */
export function setLang(lang: string): void {
  const next: Lang = lang in translations ? (lang as Lang) : "zh";
  currentLang = next;
  // L13：检查 store.set 返回值，写入失败时提示用户
  if (!store.set("lang", next)) toast(t("storeWriteFailed"), "warn");
  document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  applyI18n();
  // 通知动态生成内容的模块（如设置面板）按新语言重建
  window.dispatchEvent(new CustomEvent("dictkit:langchange", { detail: { lang: next } }));
}

/** 初始化 i18n：读取存储的语言、刷新 DOM、绑定切换按钮。 */
export function initI18n(): void {
  if (initialized) return;
  initialized = true;
  const stored = store.get<string>("lang", "zh");
  setLang(stored);
  byId("langToggle")?.addEventListener("click", () => {
    const next: Lang = currentLang === "zh" ? "en" : "zh";
    setLang(next);
    toast(next === "zh" ? t("switchedZh") : t("switchedEn"), "info");
  });
}
