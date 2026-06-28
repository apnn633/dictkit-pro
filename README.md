# 汉语字典词典在线版 · dictkit-pro

基于 **Vite + TypeScript** 构建的汉语字典词典在线检索阅读器。支持拼音、字词、页码检索，附阅读增强、双页对照、批注笔记、主题定制、离线可用（PWA）等功能。

> ⚠️ **版权与免责声明（必读）**
>
> 本项目**仅提供阅读外壳（源代码）**，**不提供、不存储、不分发**任何词典扫描页、检索数据、Logo 或字体。
>
> - 所收录词典（现代汉语词典、现代汉语规范词典、王力古汉语字典、规范汉字表手册）版权归相应出版社与编者所有。
> - MIT 许可证仅覆盖本项目源代码，**不覆盖任何数据资产**。详见 [LICENSE](LICENSE) 的「数据资产例外声明」。
> - 使用者须**自行拥有正版词典数据**，并遵守当地著作权法。本工具仅供个人学习研究，不得用于商业用途或公开传播。
> - 如版权方反对本项目的外壳代码，请联系 issue 删除。

---

## 功能特性

- **多词典检索**：现代汉语词典、现代汉语规范词典、王力古汉语字典、规范汉字表手册
- **检索方式**：拼音（带声调/简写/模糊匹配）、单字、词语、页码直跳
- **阅读模式**：单页 / 双页跨页 / 词典对照
- **缩放交互**：滚轮缩放（光标锚点）、拖拽平移、移动端捏合手势、适合高度/适合宽度切换
- **数据多源**：本地 + 远程镜像（jsDelivr / GitHub Raw / GHProxy）自动故障转移
- **熔断防刷**：某文件/图片所有源均失败后记入熔断集合，同一会话内不再重复请求，避免配置错误时刷屏（切词典/切数据源后自动重置）
- **PWA 离线**：已浏览页面与元数据缓存，断网可读
- **个性化**：主题（浅/深/护眼/高对比）、自定义主题色、自定义字体上传、字号调节、适合高度/宽度切换
- **辅助功能**：阅读历史（可设上限自动删除最旧记录）、书签收藏、按页批注、缩略图导航、目录、i18n 中英切换
- **键盘快捷键**：翻页、缩放、旋转、全屏等

## 技术栈

| 层 | 技术 |
|---|---|
| 构建 | Vite 5 |
| 语言 | TypeScript（strict 模式，0 类型错误） |
| 测试 | Vitest（42 测试） |
| PWA | vite-plugin-pwa + Workbox |
| 数据 | 多源 JSON + 1-bit 灰度 PNG 扫描页 |

## 项目结构

```
dictkit-pro/
├── src/
│   ├── core/       # state / config / data-loader / image-loader / navigation
│   ├── search/     # pinyin / engine / highlight
│   ├── viewer/     # viewer / zoom / touch / buttons
│   ├── ui/         # 15 个组件（settings / history / notes / i18n ...）
│   ├── utils/      # dom / store / url
│   ├── types/      # dict / search / state
│   └── styles/     # 5 个 CSS
├── tests/          # Vitest 单测
├── .github/workflows/deploy.yml   # GitHub Pages 自动部署
├── index.html / vite.config.ts / tsconfig.json
└── package.json
```

---

## 数据说明（重要）

词典扫描页约 **1.9 GB / 13939 张 PNG**，**不纳入本仓库**。本项目不提供任何数据下载。

### 数据来源参考

本项目源自 [dictkit.github.io](https://dictkit.github.io/) 的重构。原项目由 4 个独立 GitHub 仓库组成，可作数据获取参考（**请自行确认版权与授权后再使用**）：

| 词典 | 原仓库 |
|---|---|
| 现代汉语词典 | [dictkit/xiandai](https://github.com/dictkit/xiandai) |
| 现代汉语规范词典 | [dictkit/guifan](https://github.com/dictkit/guifan) |
| 王力古汉语字典 | [dictkit/ghy](https://github.com/dictkit/ghy) |
| 规范汉字表手册 | [dictkit/zibiao](https://github.com/dictkit/zibiao) |

> 上述链接仅为参考。**本项目不担保这些仓库的合法性、可用性与数据完整性**，使用者须自行评估并承担风险。若版权方反对，请向对应仓库的权利人主张。

### 数据目录结构

若你已合法获取数据，需按以下结构放置到本地 `data/` 目录：

```
data/
├── dicts.json          # 配置文件
├── xiandai/
│   ├── images/         # 内容页 PNG
│   ├── extra/          # 封皮/附录页 PNG
│   └── data/           # pinyin.json / chars.json / words.json / toc.json
├── guifan/ ...
├── ghy/ ...
└── zibiao/ ...
```

---

## 发行版 vs 本地开发版

本项目区分两种使用场景：

### 1. 本地开发版（推荐，支持 CDN 外链）

开发者本地克隆后，既可用本地 `data/` 目录，也可在 `data/dicts.json` 配置远程 CDN 外链（jsDelivr / GitHub Raw / GHProxy）作为数据源。适合开发调试与个人本地使用。

```bash
# 1. 安装依赖
npm install

# 2. 准备数据目录（符号链接或复制到项目根的 data/）
ln -s /path/to/your-data data

# 3. 启动开发服务器
npm run dev

# 4. 类型检查 / 测试 / 构建
npm run typecheck
npm test
npm run build
```

本地开发时，若 `data/` 存在则优先用本地数据；也可在 `data/dicts.json` 的 `dataSources` 配置远程 CDN 外链，切换数据来源使用。

### 2. 发行版（GitHub Pages 部署，仅本地数据）

通过 GitHub Actions 自动构建部署到 GitHub Pages。**发行版默认不携带任何数据**，运行时尝试加载本地 `data/dicts.json`，失败后回退到由环境变量 `VITE_REMOTE_OWNER/REPO` 指定的远程数据仓库（若已配置）。

#### 首次部署步骤

1. **Fork 或推送本仓库到 GitHub**

2. **（可选）配置远程数据仓库位置**：在仓库 Settings → Secrets and variables → Actions → Variables 添加：
   - `VITE_REMOTE_OWNER` = 承载数据的 GitHub 用户/组织名
   - `VITE_REMOTE_REPO` = 数据仓库名（集中仓库模式，所有词典同一仓库）
   - `VITE_REMOTE_BRANCH` = 分支（默认 main）
   - `VITE_REMOTE_BASEPATH` = 数据在仓库内的路径（默认 data）
   - `VITE_REMOTE_PERREPO` = 是否每词典独立仓库（`true`/`false`，默认 `false`）。设为 `true` 时 `VITE_REMOTE_REPO` 被忽略，按 `{owner}/{词典repo}/{basePath}` 拼接

   > ⚠️ **请确保你有权分发所指向的数据仓库内容**。若数据受版权保护，请勿配置此项或将其设为私有仓库。

3. **启用 GitHub Pages**：仓库 Settings → Pages → Source 选 `GitHub Actions`

4. 推送到 `main`，Actions 跑完后访问 Pages URL 即可

#### 运行时数据加载流程

**本地开发版**（`npm run dev`）：
1. 优先尝试 `data/dicts.json`（本地）
2. 失败则回退到远程候选源

**发行版**（GitHub Pages）：
1. **不尝试本地** `data/dicts.json`（避免 GitHub Pages 伪 200 + HTML 404 页导致解析失败）
2. 直接从远程候选源加载，顺序为：
   - `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{basePath}/dicts.json`（集中仓库）
   - 或 `https://cdn.jsdelivr.net/gh/{owner}/{词典repo}@{branch}/{basePath}/dicts.json`（perRepo 模式）
3. 依次回退 jsDelivr Fastly、GitHub Raw、jsdmirror、GHProxy

词典图片与检索数据同样走多源回退，单一 CDN 故障不影响使用。

> 🔧 **perRepo 模式**：当数据分散在每本词典各自的仓库（如 `dictkit/xiandai`、`dictkit/guifan`）时，设置 `VITE_REMOTE_PERREPO=true`，URL 按 `{owner}/{词典repo}/{basePath}` 拼接；集中仓库模式则按 `{owner}/{repo}/{basePath}/{词典repo}` 拼接。

> 🛡️ **熔断机制**：某文件/图片在所有候选源都失败后，会被记入熔断集合，同一会话内不再重复请求（避免配置错误时刷屏）。切换词典或数据源后熔断记录自动重置。

---

## 词典数据配置

`data/dicts.json` 是核心配置，定义了词典列表、页结构、数据源、字体、远程位置等。详细字段见 [src/types/dict.ts](src/types/dict.ts) 的 `DictConfig` 类型。

## 许可证

- **源代码**：MIT（详见 [LICENSE](LICENSE)）
- **数据资产**：不在 MIT 覆盖范围，版权归相应权利人所有，本仓库不分发

## 致谢

- 原项目：[dictkit.github.io](https://dictkit.github.io/)
- 词典数据：dictkit/xiandai、dictkit/guifan、dictkit/ghy、dictkit/zibiao（版权归原作者所有）
