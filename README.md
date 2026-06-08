# 答题小助手 （Quiz Assistant）

一个基于 **Electron + Vue 3 + Shadcn-Vue** 的桌面端答题/刷题/考试工具，支持 AI 生成题目与智能判题。

<p align="center">
  <img src="frontend/public/favicon1.ico" width="64" alt="icon">
</p>

## 功能特性

- 📤 **题库上传** — 支持 Excel / CSV 文件导入，自动解析题目（单选/多选/判断/简答/填空）
- 📝 **答题模式** — Bento 风格三栏布局（统计｜答题｜错题），题型筛选，实时进度
- 📊 **考试模式** — 自定义组卷（题型数量配置），计时考试，成绩统计
- 🤖 **AI 生成题目** — 接入 DeepSeek API，一键生成各类型题目（5 种题型）
- 🎯 **AI 智能判题** — 主观题（简答/填空）AI 自动判分
- 📈 **统计面板** — Chart.js 答题统计（Doughnut + 横向 Bar 图）
- 📕 **错题本** — 答题错题自动收集，支持按类型筛选和回顾
- 🌙 **深色模式** — 低饱和度柔和配色，圆形扩散动画切换
- 🪟 **Frameless 窗口** — Mica 磨玻璃标题栏，自定义窗口控制（最小化/最大化/关闭）
- 🧭 **功能引导** — driver.js 新手引导，分步介绍核心功能

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 31 |
| 前端 | Vue 3 + Vite + Shadcn-Vue + Tailwind CSS v4 |
| 后端 | Express（内嵌于 Electron 主进程，端口 13002） |
| 数据库 | SQLite（better-sqlite3） |
| AI | DeepSeek API（题目生成 + 判题） |
| 图表 | Chart.js + vue-chartjs |
| 打包 | electron-builder（NSIS 安装包） |

## 快速开始

### 环境要求

- Node.js 18+
- Windows 10/11（应用目前仅支持 Windows 构建）

### 开发

```bash
# 安装依赖
yarn install
cd frontend && yarn install && cd ..

# 启动开发模式（Vite dev server + Electron）
yarn dev
```

### 构建

```bash
# 构建前端 + 打包 Windows 安装包
yarn build:win
```

构建产物输出到 `release/` 目录。

### 配置 AI 功能

在应用中打开设置（⚙️），填入 DeepSeek API Key 即可使用 AI 生成题目和 AI 判题功能。

## 项目结构

```
├── main.js              # Electron 主进程入口
├── preload.js           # 预加载脚本（IPC 桥接）
├── backend/
│   ├── app.js           # Express 服务器（题库 CRUD、组卷）
│   ├── db.js            # SQLite 数据库层
│   └── ai/              # AI 功能模块
│       ├── index.js     # AI 路由挂载
│       ├── deepseek.js  # DeepSeek API 客户端
│       ├── generator.js # AI 题目生成
│       └── judge.js     # AI 自动判题
├── frontend/
│   ├── src/
│   │   ├── App.vue     # 根组件（三栏布局）
│   │   ├── components/
│   │   │   ├── Quiz.vue          # 答题区
│   │   │   ├── Exam.vue          # 考试弹窗
│   │   │   ├── StatsPanel.vue    # 统计面板
│   │   │   ├── WrongAnswerPanel.vue  # 错题本
│   │   │   ├── BankSelector.vue  # 题库选择器
│   │   │   ├── AiGeneratePanel.vue   # AI 生成面板
│   │   │   ├── TitleBar.vue      # 自定义标题栏
│   │   │   ├── AppTour.vue       # 功能引导
│   │   │   └── ui/               # Shadcn-Vue UI 组件
│   │   ├── ai/           # AI 前端模块
│   │   ├── composables/  # 组合式函数
│   │   ├── stores/       # 状态管理（Pinia）
│   │   └── api.js        # 后端 API 封装
│   └── dist/             # 构建产出
└── release/              # 打包产物
```

## 下载

前往 [Releases](https://github.com/ispacewang/question/releases) 页面下载最新版安装包。
