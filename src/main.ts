// ============================================================
// main.ts — 应用入口
// ============================================================

import { state } from "./core/state.ts";
import { loadConfig } from "./core/config.ts";
import { loadDictData } from "./core/data-loader.ts";
import { clearDictCache } from "./core/image-loader.ts";
import { normalizePageId, getFirstPageId } from "./core/navigation.ts";
import { showImage } from "./viewer/viewer.ts";
import { initDesktopZoom } from "./viewer/zoom.ts";
import { initTouchInteraction } from "./viewer/touch.ts";
import { initViewerButtons } from "./viewer/buttons.ts";
import { initSearchBar, clearSearchInput } from "./ui/search-bar.ts";
import { initSettings } from "./ui/settings.ts";
import { initHistory, recordHistory } from "./ui/history.ts";
import { initBookmarks } from "./ui/bookmarks.ts";
import { initNotes } from "./ui/notes.ts";
import { initSidebarToggle, setupSidebar, getLastPosition } from "./ui/sidebar.ts";
import { initThumbnails, refreshThumbnails } from "./ui/thumbnails.ts";
import { initCompare } from "./ui/compare.ts";
import { initPinyinPopup } from "./ui/popup.ts";
import { initUrlSync } from "./ui/url-sync.ts";
import { initKeyboardShortcuts } from "./ui/keyboard.ts";
import { initServiceWorker } from "./ui/sw.ts";
import { initProgress, updateProgress } from "./ui/progress.ts";
import { initI18n, t } from "./ui/i18n.ts";
import { byId } from "./utils/dom.ts";
import { getURLParams } from "./utils/url.ts";
import { toast } from "./ui/toast.ts";

const pendingDictLoads: Record<string, Promise<void> | undefined> = {};

document.addEventListener("DOMContentLoaded", async () => {
    showLoading(true);
    try {
        await loadConfig();
        populateDictSelector();
        initI18n();
        initSettings();
        initSearchBar();
        initHistory();
        initBookmarks();
        initNotes();
        initSidebarToggle();
        initThumbnails();
        initCompare();
        initPinyinPopup();
        initUrlSync();
        initKeyboardShortcuts();
        initProgress();
        initViewerButtons();
        initDesktopZoom();
        initTouchInteraction();

        // M8：订阅 localStorage 写入失败事件，向用户提示
        window.addEventListener("dictkit:store-error", () => {
            toast(t("storeWriteFailed"), "warn", 5000);
        });

        // 急切加载默认词典，其余后台懒加载
        const repos = Object.keys(state.dicts);
        if (repos.length === 0) {
            const list = byId("bookmarksList");
            if (list) list.textContent = t("noDictConfig");
            return;
        }
        await loadDictData(repos[0]);
        await setupSidebar();

        // 懒加载剩余词典
        for (const repo of repos.slice(1)) {
            pendingDictLoads[repo] = loadDictData(repo).catch(err => {
                console.warn(`后台加载失败 ${repo}:`, err);
            });
        }

        // 从 URL 参数或保存的上次位置初始化
        await initFromURL();

        document.body.dataset.ready = "true";
    } catch (err) {
        console.error("初始化失败:", err);
        const list = byId("bookmarksList");
        if (list) list.textContent = `${t("initFailed")}：${(err as Error).message}`;
        toast(t("initFailed"), "error");
    } finally {
        showLoading(false);
    }

    initServiceWorker();
});

function populateDictSelector(): void {
    const sel = byId<HTMLSelectElement>("dictSelector");
    if (!sel) return;
    sel.innerHTML = "";
    for (const dict of Object.values(state.dicts)) {
        sel.append(new Option(dict.name, dict.repo));
    }
    sel.value = state.currentDict ?? "";
    sel.addEventListener("change", () => {
        void switchDict(sel.value).catch(err => console.warn("switchDict failed:", err));
    });
}

async function switchDict(repo: string): Promise<void> {
    if (pendingDictLoads[repo]) {
        try {
            await pendingDictLoads[repo];
        } catch (err) {
            console.warn(`待处理加载失败 ${repo}:`, err);
        }
    }
    const prev = state.currentDict;
    state.currentDict = repo;
    const dict = state.dicts[repo];
    if (!dict) return;
    // 同步顶部词典选择器 UI（M3：URL/书签/历史触发切换后下拉框需更新）
    const sel = byId<HTMLSelectElement>("dictSelector");
    if (sel) sel.value = repo;
    const logo = byId<HTMLImageElement>("dictLogo");
    if (logo) {
        logo.src = dict.logo;
        logo.alt = `${dict.name} Logo`;
    }
    clearSearchInput();
    if (prev) clearDictCache(prev);

    // 恢复上次位置或跳到首页
    const last = getLastPosition(repo);
    state.currentPage = last || getFirstPageId(repo);

    await setupSidebar();
    refreshThumbnails();
    await showImage(state.defaults.preloadCount ?? 2);
    recordHistory({ dict: repo, page: state.currentPage });
    updateProgress();
}

/**
 * 切换到指定词典（完整流程）。供书签/历史/笔记等跨词典跳转复用（S3）。
 * 切换后调用方需自行 setCurrentPage + showImage。
 */
export async function switchToDict(repo: string): Promise<void> {
    if (repo === state.currentDict) return;
    await switchDict(repo);
}

async function initFromURL(): Promise<void> {
    const params = getURLParams();
    let dictParam: string | null = params.dict ?? null;
    const pageParam = params.page;
    const queryParam = params.query;

    if (!dictParam || !state.dicts[dictParam]) dictParam = state.currentDict;

    // URL 请求了不同词典则切换（加载数据 + 显示上次位置）
    const dictChanged = dictParam !== state.currentDict;
    if (dictChanged && dictParam) {
        await switchDict(dictParam);
    }

    // URL query（搜索词）优先于 page
    if (queryParam && !pageParam) {
        const input = byId<HTMLInputElement>("searchInput");
        if (input) input.value = queryParam;
        byId("searchBtn")?.click();
        return;
    }

    // URL page 参数覆盖词典的上次位置
    if (pageParam) {
        const cleaned = String(pageParam).replace(/^0+/, "") || pageParam;
        const page = normalizePageId(cleaned);
        // M17：显式校验 currentDict，避免对 null 取值
        const repo = state.currentDict;
        if (page && repo) {
            state.currentPage = page;
            await showImage(state.defaults.preloadCount ?? 2);
            recordHistory({ dict: repo, page });
            updateProgress();
        } else if (!page) {
            const result = byId("searchResult");
            if (result) result.textContent = t("pageParamInvalid");
            if (!dictChanged) await showImage(state.defaults.preloadCount ?? 2);
        }
        return;
    }

    // URL 无 page/query。若刚切换词典，switchDict 已显示上次位置；否则恢复上次位置
    if (!dictChanged) {
        const repo = state.currentDict;
        // M17：repo 为 null 时回退到首本字典或首页面，避免 getLastPosition(null)
        const last = repo ? getLastPosition(repo) : null;
        state.currentPage = last || getFirstPageId();
        await showImage(state.defaults.preloadCount ?? 2);
        updateProgress();
    }
}

function showLoading(show: boolean): void {
    const el = byId("loadingOverlay");
    if (el) el.hidden = !show;
}
