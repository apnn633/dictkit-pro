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
- **数据多源**：本地 + 远程镜像（jsDelivr / GitHub Raw / GHProxy 等）自动故障转移
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

### 数据目录结构（本地开发用）

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

## 配置机制（两层，重要）

本项目区分两种使用场景：**本地开发版** 与 **发行版（GitHub Pages）**。两者都依赖一份 `dicts.json` 配置文件，配置文件里又指定了数据（图片/检索 JSON）的存放位置。因此存在两层配置：

| 层级 | 决定什么 | 在哪里设置 |
|---|---|---|
| **第一层：环境变量** `VITE_REMOTE_*` | `dicts.json` 配置文件从哪个仓库下载 | GitHub Actions Variables（部署时）|
| **第二层：dicts.json 的 `remote` 字段** | 图片和检索数据从哪个仓库下载 | dicts.json 文件内容 |

> ⚠️ **常见误解**：环境变量 `VITE_REMOTE_*` **只决定配置文件本身的位置**，不决定数据位置。数据位置由配置文件里的 `remote` 字段决定。如果只改了环境变量而没改 dicts.json 里的 `remote.owner`，数据仍会从 dicts.json 指向的仓库下载。

### dicts.json 配置文件结构

`data/dicts.json` 是核心配置，定义了词典列表、页结构、数据源、字体、远程位置等。关键字段：

```jsonc
{
  "remote": {
    "owner": "dictkit",      // 数据所在 GitHub 用户/组织名
    "branch": "main",        // 分支
    "basePath": "docs",      // 数据在仓库内的根路径
    "perRepo": true          // 是否每词典独立仓库
  },
  "dataSources": [           // 数据源候选（按 priority 排序）
    { "id": "local", "type": "local", "base": "data", "priority": 0 },
    { "id": "github-raw", "type": "remote", "url": "https://raw.githubusercontent.com/:owner/:repo/refs/heads/:branch/:filepath", "priority": 1 },
    { "id": "jsdelivr", "type": "remote", "url": "https://cdn.jsdelivr.net/gh/:owner/:repo/:filepath", "priority": 2 }
    // ... 可加 jsdelivr-fastly / jsdmirror / ghproxy 等
  ],
  "dicts": [ /* 词典列表 */ ],
  "defaults": { /* 默认值 */ }
}
```

详细字段定义见 [src/types/dict.ts](src/types/dict.ts) 的 `DictConfig` / `RemoteConfig` 类型。

### perRepo 字段（数据仓库组织方式）

`remote.perRepo` 决定数据仓库的组织方式，影响图片/检索数据的 URL 拼接：

| perRepo | 含义 | URL 路径拼接 | 仓库结构示例 |
|---|---|---|---|
| `false`（缺省） | 统一仓库：所有词典数据放一个仓库 | `${basePath}/${词典repo}/${文件}` | `my-data/data/xiandai/images/0001.png` |
| `true` | 每词典独立仓库：repo 名即仓库名 | `${basePath}/${文件}` | `xiandai 仓库的 docs/images/0001.png` |

URL 模板里的 `:owner` 用 `remote.owner` 替换，`:repo` 用词典的 `repo` 字段替换，`:branch` 用 `remote.branch`，`:filepath` 用拼接后的路径。

---

## 本地开发版

开发者本地克隆后，既可用本地 `data/` 目录，也可在 `data/dicts.json` 配置远程 CDN 外链作为数据源。适合开发调试与个人本地使用。

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

---

## 发行版（GitHub Pages 部署）

通过 GitHub Actions 自动构建部署到 GitHub Pages。**发行版默认不携带任何数据**，运行时从远程仓库加载配置和数据。

### 首次部署步骤

1. **Fork 或推送本仓库到 GitHub**

2. **配置远程配置文件仓库位置**：在仓库 Settings → Secrets and variables → Actions → Variables 添加：
   - `VITE_REMOTE_OWNER` = 承载 `dicts.json` 配置文件的 GitHub 用户/组织名
   - `VITE_REMOTE_REPO` = 配置文件所在仓库名
   - `VITE_REMOTE_BRANCH` = 分支（默认 main）
   - `VITE_REMOTE_BASEPATH` = dicts.json 在仓库内的路径（默认 data）

   > 这四个变量只决定 `dicts.json` 配置文件从哪下载。程序会从 `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{basePath}/dicts.json` 拉取配置。

   > ⚠️ **数据位置由 dicts.json 里的 `remote` 字段决定，不是环境变量**。详见上文「配置机制」。

3. **启用 GitHub Pages**：仓库 Settings → Pages → Source 选 `GitHub Actions`

4. 推送到 `main`，Actions 跑完后访问 Pages URL 即可

### 运行时数据加载流程

**本地开发版**（`npm run dev`）：
1. 优先尝试 `data/dicts.json`（本地）
2. 失败则回退到环境变量指定的远程候选源

**发行版**（GitHub Pages）：
1. **不尝试本地** `data/dicts.json`（避免 GitHub Pages 对不存在路径返回伪 200 + HTML 404 页导致解析失败）
2. 用环境变量 `VITE_REMOTE_*` 拼接候选 URL，依次尝试下载 `dicts.json`：
   - `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{basePath}/dicts.json`
   - `https://fastly.jsdelivr.net/gh/{owner}/{repo}@{branch}/{basePath}/dicts.json`
   - `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{basePath}/dicts.json`
3. 配置加载成功后，图片与检索数据按 dicts.json 里 `remote` 字段 + `dataSources` 候选源多源回退加载

> 🛡️ **熔断机制**：某文件/图片在所有候选源都失败后，会被记入熔断集合，同一会话内不再重复请求（避免配置错误时刷屏）。切换词典或数据源后熔断记录自动重置。

---

## 如何指向自己的数据仓库

### 场景 A：所有词典数据放一个仓库（推荐，最简单）

1. 建一个数据仓库（如 `myname/dict-data`），结构：
   ```
   dict-data/
   └── data/
       ├── dicts.json
       ├── xiandai/
       │   ├── images/0001.png ...
       │   └── data/pinyin.json ...
       ├── guifan/ ...
       └── ...
   ```
2. 编辑 `dicts.json`，设 `remote` 指向你的仓库，`perRepo=false`：
   ```json
   "remote": {
     "owner": "myname",
     "branch": "main",
     "basePath": "data",
     "perRepo": false
   }
   ```
3. 设置 GitHub Actions Variables：
   - `VITE_REMOTE_OWNER` = `myname`
   - `VITE_REMOTE_REPO` = `dict-data`
   - `VITE_REMOTE_BASEPATH` = `data`

   请求链路：
   ```
   下载配置 → cdn.jsdelivr.net/gh/myname/dict-data@main/data/dicts.json
   下载图片 → cdn.jsdelivr.net/gh/myname/dict-data@main/data/xiandai/images/0001.png
   ```

### 场景 B：每本词典一个独立仓库（如 fork 原项目结构）

1. 为每本词典建一个仓库（如 `myname/xiandai`、`myname/guifan`），各自结构：
   ```
   xiandai/
   └── docs/            ← basePath
       ├── images/0001.png ...
       └── data/pinyin.json ...
   ```
2. `dicts.json` 可放在任意一个仓库（如 `myname/xiandai/docs/dicts.json`），设 `remote.perRepo=true`：
   ```json
   "remote": {
     "owner": "myname",
     "branch": "main",
     "basePath": "docs",
     "perRepo": true
   }
   ```
3. 设置 GitHub Actions Variables（指向存放 dicts.json 的那个仓库）：
   - `VITE_REMOTE_OWNER` = `myname`
   - `VITE_REMOTE_REPO` = `xiandai`
   - `VITE_REMOTE_BASEPATH` = `docs`

   请求链路：
   ```
   下载配置 → cdn.jsdelivr.net/gh/myname/xiandai@main/docs/dicts.json
   下载图片 → cdn.jsdelivr.net/gh/myname/xiandai@main/docs/images/0001.png
              （:repo 占位符被词典的 repo 字段替换）
   ```

> ⚠️ **请确保你有权分发所指向的数据仓库内容**。若数据受版权保护，请勿公开仓库或将其设为私有（注意 jsDelivr 等 CDN 不支持私有仓库）。

---

## 许可证

- **源代码**：MIT（详见 [LICENSE](LICENSE)）
- **数据资产**：不在 MIT 覆盖范围，版权归相应权利人所有，本仓库不分发

## 致谢

- 原项目：[dictkit.github.io](https://dictkit.github.io/)
- 词典数据：dictkit/xiandai、dictkit/guifan、dictkit/ghy、dictkit/zibiao（版权归原作者所有）
