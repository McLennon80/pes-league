# 实况足球联赛 · 积分榜 & 赛程

一个用于记录朋友间实况足球联赛的轻量网站：手动添加比赛、记录比分与进球队员，自动统计积分榜与射手榜，数据云端互通。

## 功能

- 积分榜：按「积分 → 净胜球 → 进球数」自动排名
- 射手榜：按进球队员统计
- 赛程 & 比赛：列表展示、可删除
- 添加比赛：录入日期/轮次/主客队/比分/进球队员（按顺序）
- 选手管理：增删选手（默认 4 名）

## 技术架构

- 前端：单文件 `index.html`（原生 JS，无构建）
- 后端：Vercel Serverless Function（`api/index.js`，对应路由 `/api`）
- 数据：Upstash Redis（REST API，单 key 存整份数据）
- API 约定：前端统一 `GET /api`（读全部数据）或 `POST /api`（`body.action` 区分 addMatch / deleteMatch / addPlayer / deletePlayer）

## 部署到 Vercel（一次配置，长期可用）

### 第 1 步：准备 Upstash Redis

1. 打开 https://console.upstash.com ，用 GitHub 账号登录
2. 点 **Create Database** → 选 **Redis** → 区域选任意（如 `us-east-1`）→ 免费档 → 创建
3. 进入该数据库详情页，复制两个值：
   - **REST URL**（`UPSTASH_REDIS_REST_URL`，形如 `https://xxx.upstash.io`）
   - **Token**（`UPSTASH_REDIS_REST_TOKEN`，形如 `AX...`）

### 第 2 步：把项目放到 GitHub

1. 在 GitHub 新建一个仓库（如 `pes-league`），不要勾选初始化 README
2. 本地把本项目目录 `git init`、`git add .`、`git commit`、`git push` 到该仓库
   （或直接在 GitHub 网页把本目录所有文件上传）

### 第 3 步：导入 Vercel 并配置环境变量

1. 打开 https://vercel.com ，用 GitHub 登录
2. 点 **Add New → Project**，导入刚才的 GitHub 仓库
3. 框架预设选 **Other**（或留空），直接 **Deploy**
4. 部署完成后，进入项目 **Settings → Environment Variables**，添加两个变量：
   - `UPSTASH_REDIS_REST_URL` = 第 1 步的 REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = 第 1 步的 Token
5. 回到 **Deployments**，点最新一次部署右侧的 **⋯ → Redeploy**（让环境变量生效）
6. 部署完成后，即可通过 `https://你的项目名.vercel.app` 访问，转发给朋友即可

## 本地预览

前端静态页面可直接双击 `index.html` 打开，但此时调用 `/api/*` 会失败（无后端）。
如需完整本地预览，可临时用 `server.js`（本地文件存储版）：

```bash
node server.js
# 访问 http://localhost:3000
```

> 注意：`server.js` 用的是本地 `data.json` 文件存储，与线上 Upstash 数据**不互通**，仅用于本地开发调试。
