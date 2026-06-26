// ============================================================
// types/state.ts — Runtime state shape
// ============================================================
import type { DictConfig, DictMeta, DataSource, FontOption, SearchFile, Defaults, PageConfig } from "./dict";
import type { SearchFilter } from "./search";

/** Fit mode for the viewer. */
export type FitMode = "fit" | "width" | "manual";

/** Proxy health tracking per resource kind. */
export interface ProxyState {
  lastSuccess: string | null;
  lastSuccessTime: number;
  failed: Set<string>;
}

/** A cached image entry. */
export interface CachedImage {
  url: string;
  timestamp: number;
}

/** A reading-history entry. */
export interface HistoryEntry {
  dict: string;
  page: string;
  query?: string;
  term?: string;
  ts: number;
}

/** A user bookmark. */
export interface Bookmark {
  dict: string;
  page: string;
  note: string;
  ts: number;
}

/** A user annotation / note attached to a page. */
export interface Note {
  id: string;
  dict: string;
  page: string;
  text: string;
  ts: number;
  updatedAt: number;
}

/** Custom keyboard shortcut binding. */
export interface KeyBinding {
  action: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/** The global app state. */
export interface AppState {
  // Configuration (loaded from data/dicts.json)
  config: DictConfig | null;
  dicts: Record<string, DictMeta>;
  files: SearchFile[];
  fonts: FontOption[];
  dataSources: DataSource[];
  defaults: Partial<Defaults>;

  // Runtime
  currentDict: string | null;
  currentPage: string;
  imageLoadToken: number;
  isSpreadMode: boolean;
  zoomLevel: number;
  rotation: number;
  fitMode: FitMode;

  // Search
  searchFilter: SearchFilter;
  highlightedIndex: number;

  // UI
  compareMode: boolean;
  compareDict: string | null;
  selectedDataSourceId: string;

  // Cache (not persisted)
  imageCache: Map<string, CachedImage>;
  loadingPromises: Map<string, Promise<string>>;
  loadingControllers: Map<string, AbortController>;
  preloadedImages: Set<string>;
  proxyState: Record<string, ProxyState>;
}

export type { PageConfig };
