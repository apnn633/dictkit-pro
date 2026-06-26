// ============================================================
// types/dict.ts — Dictionary & config domain types
// ============================================================

/** A page group inside a dictionary (header / content / footer). */
export interface PageGroup {
  count: number;
  prefix: string;
}

/** Page layout config for one dictionary. */
export interface PageConfig {
  content: PageGroup;
  header: PageGroup;
  footer: PageGroup;
}

/** A registered dictionary. */
export interface DictMeta {
  name: string;
  repo: string;
  pages: PageConfig;
  logo: string;
  // Data slots filled lazily by data-loader
  pinyin: Record<string, unknown> | null;
  chars: Record<string, unknown> | null;
  words: Record<string, unknown> | null;
  toc: Record<string, unknown> | null;
}

/** Local data source (bundled with the site). */
export interface LocalDataSource {
  id: string;
  name: string;
  priority: number;
  type: "local";
  base: string;
}

/** Remote mirror data source (GitHub Raw, jsDelivr, etc.). */
export interface RemoteDataSource {
  id: string;
  name: string;
  priority: number;
  type: "remote";
  url: string;
}

export type DataSource = LocalDataSource | RemoteDataSource;

/** Search index file definition. */
export interface SearchFile {
  path: string;
  key: "pinyin" | "chars" | "words" | "toc";
  type: string;
  weight: number;
}

/** Font option. */
export interface FontOption {
  id: string;
  name: string;
  stack: string;
}

/** Remote repo location. */
export interface RemoteConfig {
  owner: string;
  branch: string;
  basePath: string;
  /**
   * 是否每本词典对应一个独立仓库。
   * - false（缺省）：统一仓库，路径拼接为 `${basePath}/${repo}/${logicalPath}`
   *   （一个仓库内按 repo 子目录存放各词典数据）
   * - true：每词典独立仓库，repo 字段即仓库名，路径拼接为 `${basePath}/${logicalPath}`
   *   （仓库本身就是该词典，无需再加 repo 子目录）
   */
  perRepo?: boolean;
}

/** Site metadata. */
export interface SiteMeta {
  name: string;
  short_name: string;
  description: string;
  version: string;
  author: string;
}

/** Defaults applied on first load / when nothing is stored. */
export interface Defaults {
  fontId: string;
  themeId: string;
  zoomLevel: number;
  spreadMode: boolean;
  dataSourceId: string;
  maxResults: number;
  preloadCount: number;
  historyLimit: number;
  bookmarkLimit: number;
  imageSuffix?: string;
}

/** Top-level dicts.json shape. */
export interface DictConfig {
  meta: SiteMeta;
  dataSources: DataSource[];
  remote: RemoteConfig;
  fonts: FontOption[];
  files: SearchFile[];
  dicts: Array<Omit<DictMeta, "logo" | "pinyin" | "chars" | "words" | "toc">>;
  defaults: Defaults;
}
