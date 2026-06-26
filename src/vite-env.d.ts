/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 远程数据仓库 owner（GitHub 用户/组织名） */
  readonly VITE_REMOTE_OWNER?: string;
  /** 远程数据仓库名 */
  readonly VITE_REMOTE_REPO?: string;
  /** 远程数据仓库分支，默认 main */
  readonly VITE_REMOTE_BRANCH?: string;
  /** 远程数据在仓库内的基础路径，默认 data */
  readonly VITE_REMOTE_BASEPATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
