# MindTrace

在浏览网页时，快速记录灵感，并自动保留思考上下文。

> 减少思维中断，快速捕获灵感。

## 项目结构

```
MindTrace/
├── manifest.json      # Chrome MV3 配置
├── popup.html         # 弹窗：最近 5 条 + 打开灵感库
├── popup.js / popup.css
├── dashboard.html     # 灵感库：全部记录、搜索、删除、滚动加载
├── dashboard.js / dashboard.css
├── graph.html         # 思维宇宙：认知图谱（react-force-graph）
├── graph/             # 图谱页源码与样式
├── content.js         # 内容脚本：划词、按钮、记录面板
├── content.css
├── storage.js         # chrome.storage.local 元数据 + IndexedDB 向量合并
├── services/          # 关键词、语义向量、关联、聚类（预留）
├── lib/               # esbuild：embedding.worker.js、graph.bundle.js、WASM
├── workers/           # Worker 源码
├── utils.js           # 工具函数（ID、时间、转义等）
├── icons/
├── package.json
└── scripts/
    ├── build-embedding.mjs
    └── generate-icons.ps1
```

## 数据结构

每条灵感记录：

```json
{
  "id": "1715000000000-abc123xyz",
  "selectedText": "用户划选的原文",
  "note": "用户的想法",
  "pageTitle": "网页标题",
  "pageUrl": "https://example.com/page",
  "createdAt": 1715000000000,
  "keywords": ["关键词"],
  "embedding": null
}
```

- 元数据存储键：`mindtrace_inspirations`（`chrome.storage.local`，**不含** embedding 大数组）
- 向量存储：`IndexedDB` 数据库 `mindtrace_embeddings`，按记录 `id` 存 384 维向量

## 构建（语义模型 + 认知图谱）

首次克隆或修改 Worker / 图谱源码后执行： 

```bash
npm install
npm run build:all
```

- `npm run build` — 仅打包 `lib/embedding.worker.js` 与 `lib/wasm/`（思维花园语义关联）
- `npm run build:graph` — 仅打包 `lib/graph.bundle.js`（思维宇宙页 React）
- `npm run build:all` — 上述两者

图谱页在 extension 内单独加载 bundle，不影响 dashboard 时间线体积。

### 思维宇宙（认知图谱）

1. 打开思维花园 `dashboard.html`
2. 点击顶栏 **思维宇宙**，或访问 `graph.html`
3. 有 embedding 的思考两两相似度 &gt; 0.78 时显示发光连线；节点大小反映 weight（关联度 + 活跃度 + 中心性）
4. 首次进入可自动 backfill 缺失向量（与花园共用 Worker 模型）

## 本地加载到 Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本项目文件夹 `MindTrace/`
5. 固定工具栏图标，即可使用

## 使用方式

1. 打开任意网页
2. 鼠标划选一段文字（至少 2 个字符）
3. 选区附近出现 **记录灵感** 按钮
4. 点击后填写「我的想法」，点击 **保存**
5. 右下角提示「✓ 已保存到 MindTrace」
6. 点击工具栏图标：popup 查看最近 5 条；点击 **打开灵感库** 进入 dashboard 管理全部记录

## 调试

### Content Script

1. 在网页上 **右键 → 检查**
2. **Console** 中筛选 `[MindTrace]` 日志
3. `chrome://extensions/` → MindTrace → **Service Worker**（本 MVP 无 background，可忽略）
4. 修改 `content.js` 后，在 `chrome://extensions/` 点击 **重新加载** 扩展，并 **刷新网页**

### Popup

1. 右键点击工具栏 MindTrace 图标 → **检查弹出内容**
2. 在 DevTools 中调试 `popup.js` / `storage.js`

### Storage

1. `chrome://extensions/` → MindTrace → **检查视图** 或 popup 的 DevTools
2. Console 执行：

```javascript
chrome.storage.local.get('mindtrace_inspirations', console.log)
```

## 下一阶段：扩展 AI 功能（建议路径）

| 阶段 | 模块 | 说明 |
|------|------|------|
| 1 | `background.js` | Service Worker，统一处理 API 请求，避免在 content 中暴露 Key |
| 2 | `ai/summarize.js` | 保存后可选「AI 提炼一句话」写入 `record.aiSummary` |
| 3 | `options.html` | 配置 API Key、模型、是否自动总结 |
| 4 | `ai/embeddings.js` | 本地或云端向量，支持 popup 语义搜索 |
| 5 | 导出 / 同步 | 导出 Markdown；后续再接云同步 |

`storage.js` 与 `utils.js` 已模块化，新增字段时只需扩展 `InspirationRecord` 与 `buildRecord`，无需改动 content 主流程。

## License

MIT
