# 答题小助手 v2.0 更新日志

## 🎨 UI 框架迁移：Element Plus → Shadcn-Vue + Tailwind CSS v4

全面替换 UI 框架，从 Element Plus 迁移至 Shadcn-Vue（基于 Radix-Vue + Tailwind CSS v4）。

### 新增依赖
- `tailwindcss` v4 + `@tailwindcss/vite`
- `radix-vue`（无头 UI 基元）
- `class-variance-authority` + `clsx` + `tailwind-merge`
- `lucide-vue-next`（图标库）
- `vue-sonner`（Toast 通知，替代 ElMessage）

### 移除
- `element-plus` / `@element-plus/icons-vue` / `sass-embedded`

### 自定义 UI 组件（`src/components/ui/`）
| 组件 | 替代 |
|------|------|
| `Button` | `el-button` |
| `Input` | `el-input` |
| `Textarea` | `el-input type=textarea` |
| `Select` / `SelectItem` | `el-select` |
| `Dialog` | `el-dialog` |
| `AlertDialog` | `ElMessageBox.confirm` |
| `Badge` | `el-tag` |

---

## 🪟 自定义标题栏 + 无边框窗口

- Electron 窗口设为 `frame: false`（隐藏 Windows 默认标题栏）
- `backgroundMaterial: 'mica'`（Windows 11 Mica 磨玻璃材质）
- 自定义 `TitleBar.vue`：
  - 左侧：应用图标 + "答题小助手"
  - 右侧：深色模式切换 ☀/🌙 → 窗口最小化/最大化/关闭
  - 整栏可拖拽，按钮区域 `no-drag` 防误触
  - CSS 回退：`backdrop-filter: blur(24px)` 磨玻璃效果

---

## 🌓 深色模式

- 点击标题栏 ☀/🌙 切换
- **圆形扩散动画**：从按钮位置圆形展开覆盖全窗口（View Transition API）
- 配色柔化：低饱和度灰蓝/鼠尾草绿/陶土红
- 自动记忆（localStorage）

| 语义 | 浅色 | 深色 |
|------|------|------|
| 背景 | `#fafaf9` | `#1c1c1e` |
| 主色 | `#4a7dbf` | `#6b9fd4` |
| 成功 | `#5d9b6a` | `#6fa87a` |
| 错误 | `#c2655a` | `#d4786d` |
| 警告 | `#b8954a` | `#c9a55c` |

---

## 📊 三栏布局 + 新统计面板

### 刷题模式
```
┌──────────┬──────────────────┬───────────┐
│  统计     │     答题区        │  错题本    │
│ 260px    │     1fr          │  340px    │
│          │                  │           │
│ ◯ 正确率 │  题库选择 + 题目   │  错题列表  │
│ 正确/错误 │  [提交] [下一题]  │  导出      │
│ 总题     │                  │  清空      │
│          │                  │           │
│ 题型柱图 │                  │           │
└──────────┴──────────────────┴───────────┘
```

### 考试模式
```
┌──────────┬──────────────────┬───────────┐
│  答题卡   │     题目区        │   提示     │
│ 180px    │     自适应        │  300px    │
│ 1 2 3 4  │  第 X 题         │  操作提示  │
│ 5 6 ...  │  选项 ABCD       │           │
│          │  [上题][下题][交卷]│           │
└──────────┴──────────────────┴───────────┘
```

### 统计面板（左侧栏）
- **环形图**：蓝色单色环 + 中心正确率百分比
- **数字行**：正确 / 错误 / 总题（竖线分隔）
- **横向堆叠柱形图**：按单选题/多选题/判断题分类，绿色正确 + 红色错误

---

## ⚡ 速刷模式

顺序刷题旁新增 "⚡ 速刷" 按钮：
- 激活后按钮文字变为 "提交并继续 →"
- 点击自动提交当前答案 + 加载下一题
- 无需每次都点"提交答案"

---

## 📝 错题库增强

- 错题自动存入 `localStorage`，与后端题库并列显示
- 错题库 chip 显示题目数量 + "清空" 按钮
- **前端本地刷题**：不调后端，本地判题
- **答对自动移除**：错题库中答对的题目自动删除
- 正确时显示 "（已移出错题库）"

---

## 🎯 新手引导

- 首次打开自动弹出 5 步引导（driver.js）
- 标题栏下方 "?" 按钮可随时重新查看

| 步骤 | 区域 | 说明 |
|------|------|------|
| 1 | 左侧统计 | 环形图 + 题型柱形图 |
| 2 | 中间答题 | 选择题库 → 答题 → 速刷 |
| 3 | 右侧错题本 | 错题收集 + 导出/清空 |
| 4 | 考试按钮 | 进入考试模式 |
| 5 | 🌙 按钮 | 深色/浅色切换 |

---

## 🐛 Bug 修复

| 问题 | 修复 |
|------|------|
| Toast 通知圆角 | CSS `border-radius:0 !important` |
| 标题栏随内容滚动 | `body { overflow:hidden }` + `h-screen` 固定高度 |
| 退出考试弹窗按钮太小 | AlertDialog 按钮加 `h-9 px-4` 尺寸 |
| 错题集只显示一条 | 去重用 `questionId`（数据库 ID）替代缺失的 `idx` |
| 错题库判题全错 | 判题改用 `correctAnswer` 字段（原 `answer` 字段不存在于 localStorage） |

---

## 📁 文件结构

```
frontend/src/
├── main.js                    # 入口：移除 Element Plus，加 vue-sonner
├── style.css                  # Tailwind + 浅/深主题变量 + Bento 零圆角
├── App.vue                    # 主布局：三栏 + 考试 + 弹窗
├── api.js                     # 后端 API 封装
├── lib/utils.js               # cn() class 合并工具
├── stores/theme.js            # 深色模式状态 + View Transition 动画
├── utils/mistakeBook.js       # 错题库 localStorage CRUD
├── components/
│   ├── TitleBar.vue           # 自定义标题栏（Mica + 窗口控制 + 深色切换）
│   ├── AppTour.vue            # 新手引导（driver.js）
│   ├── Quiz.vue               # 刷题模式（支持错题库本地刷题）
│   ├── Exam.vue               # 考试模式（三栏：答题卡|题目|提示）
│   ├── StatsCard.vue          # 统计面板（环形图 + 柱形图）
│   ├── WrongAnswerCard.vue    # 错题本（列表 + 导出 + 清空）
│   ├── BankSelector.vue       # 题库选择（chip 列表 + 上传弹窗）
│   └── ui/                    # Shadcn-Vue 组件
│       ├── Button.vue
│       ├── Input.vue
│       ├── Textarea.vue
│       ├── Select.vue / SelectItem.vue / SelectLabel.vue / SelectSeparator.vue
│       ├── Dialog.vue / DialogTitle.vue / DialogDescription.vue / DialogHeader.vue / DialogFooter.vue
│       ├── AlertDialog.vue
│       └── Badge.vue
```

---

## 🔧 构建与打包

```bash
# 前端构建
cd frontend
npm run build

# Electron 打包（Windows）
cd ..
npm run build:win
```

> Electron 配置：`frame: false` + `backgroundMaterial: 'mica'`，需 Windows 11。Windows 10 回退为 CSS 磨玻璃效果。
