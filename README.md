# 个人工作台 · Personal Workspace

一个**零依赖、离线优先**的个人工作台，纯 HTML/CSS/JavaScript 实现，数据保存在浏览器本地。
代码托管在 GitHub 公开仓库，用于版本管理与多机同步。

**在线预览**：https://dx8060.github.io/personal-workspace/
**仓库地址**：https://github.com/DX8060/personal-workspace

> 在线版与本地版功能完全一致。数据只写入你当前浏览器的 `localStorage`，不会上传到任何服务器；
> 换浏览器或清理缓存后需通过「数据与设置 → 导出 / 导入 JSON」迁移。

---

## 一、功能概览

| 模块 | 说明 |
| --- | --- |
| 总览 | 关键指标卡（未完成待办 / 进行中任务 / 近 7 日完成 / 完成率）、7 日完成量柱状图、今日待办、进行中任务、最近笔记 |
| 任务看板 | 待开始 → 进行中 → 已完成三列流转，支持**拖拽换列**、优先级、标签、截止日期、新增/编辑/删除 |
| 待办清单 | 轻量当日执行清单，勾选完成、进度条、清除已完成 |
| 链接收藏 | 按分类筛选，卡片式展示，一键跳转 |
| 笔记 | 左侧列表 + 右侧编辑器，`Ctrl / ⌘ + S` 保存 |
| 数据与设置 | JSON 导出 / 导入、恢复示例数据、清空数据、仓库信息 |

其他：浅色 / 深色主题切换（记忆偏好）、顶栏全局搜索（`/` 聚焦）、`Esc` 关闭弹窗、响应式布局。

---

## 二、目录结构

```
personal-workspace/
├── index.html              # 页面骨架与六个视图容器
├── assets/
│   ├── css/style.css       # 全部样式，含深色主题与响应式
│   └── js/
│       ├── store.js        # 数据层：默认数据、localStorage 读写、导入导出、统计
│       └── app.js          # 交互层：视图渲染、拖拽、弹窗、搜索、笔记编辑
├── start.bat               # Windows 一键启动本地服务
└── README.md
```

---

## 三、运行方式

### 方式 1：直接打开（最简单）

双击 `index.html`，浏览器即可运行。数据写入该页面的 localStorage。

### 方式 2：本地 HTTP 服务（推荐）

部分浏览器对 `file://` 协议下的存储有额外限制，用本地服务更稳定：

```bash
# 任选其一
python -m http.server 8080
npx serve .
php -S localhost:8080
```

然后访问 <http://localhost:8080>。Windows 下也可直接双击 `start.bat`。

---

## 四、数据说明

- 存储位置：浏览器 `localStorage`，键名 `workspace_state_v1`，不经过任何服务器。
- 数据结构：

```js
{
  meta:   { name, version },
  tasks:  [{ id, title, desc, status, priority, tag, due, createdAt, doneAt, order }],
  todos:  [{ id, text, done, createdAt }],
  links:  [{ id, title, url, desc, category }],
  notes:  [{ id, title, content, createdAt, updatedAt }]
}
```

- 备份与迁移：**数据与设置 → 导出 JSON 备份**，得到 `workspace-backup-YYYY-MM-DD.json`；
  换机器时用**导入备份**恢复。
- 注意：清理浏览器数据 / 无痕模式会丢失本地数据，重要内容请定期导出。

---

## 五、公开仓库 + 本地运行

仓库当前为 **Public**，仅包含程序代码（HTML / CSS / JS），**不含任何个人任务或笔记数据**。

个人数据全部保存在浏览器 `localStorage` 中，属于运行时数据，不会进入仓库；
`.gitignore` 已排除 `.workbuddy/` 与系统临时文件。因此公开仓库不会泄露使用内容。

- 版本管理与多机同步：`git clone` 后在本地运行 `start.bat` 或直接打开 `index.html`。
- 公网访问：已启用 GitHub Pages，`main` 分支根目录每次推送后自动发布，
  地址为 https://dx8060.github.io/personal-workspace/ 。
- 若后续代码中加入个人配置或密钥，请勿提交，改由本地 `config.local.js` 承载并加入 `.gitignore`。

---

## 六、可扩展方向

- 周报视图：按周聚合完成任务与新增笔记，自动生成摘要
- 数据同步：WebDAV / 对象存储，注意密钥不入库
- 全文搜索升级为分词索引
- 任务子项（checklist）与重复任务

---

## 许可

个人使用项目，未附带开源许可证。
