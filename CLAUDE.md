# CLAUDE.md

## 项目：Translate App

Windows 桌面翻译工具，基于 Tauri v2 + 原生 HTML/CSS/JS + 百度翻译 API。

## 工作流规范（Skill 强制调用）

**以下规则为 BLOCKING（阻塞级），满足触发条件时必须先调用 Skill，不允许跳过直接进入下一步。**

### 触发规则清单

> **规则 1** — 当你看到用户消息包含「bug」「报错」「崩溃」「异常」「不工作」「修一下」「修复」「有问题」「不行」「没用」「失效」等关键词时：
> → **立即调用** `Skill("anthropic-skills:bug-fix")`，传入用户描述的完整问题。
> → 在 bug-fix 流程中制定修复计划、获得用户确认后，才能开始改代码。

> **规则 2** — 当你准备说「已修复」「完成了」「改好了」「OK 了」之前：
> → **先调用** `Skill("anthropic-skills:verification-before-completion")`，实际运行验证。
> → 验证通过后才能向用户声明完成。

> **规则 3** — 当你准备执行 `git push`、`gh pr create`、`gh pr merge`、合并分支之前：
> → **先调用** `Skill("anthropic-skills:requesting-code-review")`，自查代码一致性。

> **规则 4** — 当本轮会话修改涉及 **3 个及以上文件**，或完成一轮重构后：
> → **调用** `Skill("anthropic-skills:simplify")`，检查冗余和风格统一。

> **规则 5** — 当用户要求开发**新功能**（非 bug 修复）时：
> → **先调用** `Skill("anthropic-skills:brainstorming")`，讨论方案后动手。

### 自检清单（每轮回复末尾自问）

1. 本轮是否修复了 bug？→ 我应该先调了 `bug-fix` ✅/❌
2. 本轮是否声明了"完成/已修复"？→ 我应该先调了 `verification-before-completion` ✅/❌
3. 本轮是否做了 git 推送/合并？→ 我应该先调了 `requesting-code-review` ✅/❌
4. 本轮是否改了 3+ 文件？→ 我应该调了 `simplify` ✅/❌

**关键原则：**
- "能用"不等于"修好了"——必须验证功能确实生效（打开设置、点保存、拖动窗口）
- 思考过程（thinking）使用中文
- Worktree 分支命名：`fix/<描述>` 或 `feat/<描述>`，不使用 `claude/xxx` 随机名
- 前后端字段必须一致——Rust `Settings` 结构体新增字段时，JS `save()` 对象必须同步
- `tauri.conf.json` 中 `plugins` 字段不能有子配置对象（store、global-shortcut 只接受 null）
- 百度 API 凭据绝不写入源码，只能通过设置 UI 录入

## 技术栈

- **桌面框架：** Tauri v2（Rust 后端 + Web 前端）
- **前端：** 原生 HTML/CSS/JS（ES 模块，Vite 开发服务器）
- **后端：** Rust（Tauri 命令、reqwest HTTP 请求）
- **翻译 API：** 百度翻译 API（fanyi-api.baidu.com），含 mock 回退
- **包管理：** npm、Cargo
- **目标平台：** Windows 11

## 构建命令

```bash
npm install                 # 安装前端依赖
npm run tauri dev           # 启动开发服务器 + Tauri 窗口
npm run tauri build         # 生产构建 → .msi/.exe
```

## 项目结构

```
translate-app/
├── index.html              # 入口 HTML
├── package.json            # npm 依赖和脚本
├── vite.config.js          # Vite 打包配置（Tauri API 需排除预构建）
├── src/                    # 前端源码
│   ├── main.js             # 应用入口：初始化、事件绑定、窗口拖拽
│   ├── tauri-bridge.js     # Tauri IPC 桥接：invoke + window API 封装
│   ├── translator.js       # 翻译模块：防抖、翻译、复制、清除
│   ├── settings.js         # 设置面板逻辑
│   └── styles.css          # 浅色/深色主题样式
├── src-tauri/              # Rust 后端
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # 窗口配置、应用元数据
│   ├── capabilities/default.json  # 安全权限
│   └── src/
│       ├── main.rs         # 桌面入口（自动生成）
│       ├── lib.rs          # Tauri 命令、插件、托盘、状态管理
│       ├── translator.rs   # 翻译引擎（mock + 百度 API）、语言检测
│       └── autostart.rs    # Windows 注册表自启管理
└── dist/                   # Vite 构建输出（Tauri 打包用）
```

## 前端模块说明

- **main.js** — 应用入口。加载持久化设置、应用主题、初始化翻译和设置模块、窗口拖拽（标题栏 mousedown → `__TAURI_INTERNALS__.invoke("plugin:window|start_dragging")`）、最小化/关闭/置顶/主题切换、窗口大小和位置自动保存。
- **tauri-bridge.js** — Tauri IPC 桥接。用 `window.__TAURI_INTERNALS__` 封装 `invoke` 和 `getCurrentWindow`（minimize/close/setAlwaysOnTop/startDragging/outerSize/outerPosition/setPosition/onResized/onMoved），避免 Vite 预构建问题。
- **translator.js** — 翻译控制器。输入事件防抖 500ms 后调用 `translate_text`，更新输出区域，处理语言切换和交换按钮，左下角复制按钮（SVG 图标，点击闪烁反馈），输入框右上角清除按钮（hover 容器时显示），模拟模式状态显示。状态栏仅显示"就绪"状态文字，已移除语言检测标识和字符计数。
- **settings.js** — 设置面板控制器。打开弹窗、从后端加载设置填入表单、保存时校验快捷键格式、保存时发送完整字段（含 window_x/window_y）、通过 `save_settings` 命令持久化，变更后回调通知主模块刷新 UI。
- **styles.css** — 完整浅色/深色主题，CSS 变量 + `[data-theme="dark"]`。参考 Claude Code 桌面端设计：Inter 字体（Google Fonts），暖金色强调色（`#d97706`/`#f59e0b`），10px 圆角，1px 细边框，聚焦时暖金色光晕（`box-shadow`），左右 Flexbox 布局。标题栏 38px 高，按钮 30×30。输入输出框内边距 14px，清除/复制按钮 hover 父容器时显示。状态栏无分割线，仅右侧显示"就绪"。设置弹窗带 `backdrop-filter` 模糊效果。自定义细滚动条（4px）。

## 功能清单

1. **翻译：** 用户输入时动态翻译（防抖 500ms）
   - 默认：中文输入 → 英文输出；英文/其他语言 → 中文输出
   - 支持手动切换语言、自动语言检测
2. **窗口：** 默认 620×380，始终置顶，可拖拽调整大小，居中启动，记忆位置
3. **系统托盘：** 关闭窗口隐藏到托盘，左键点击托盘图标切换显示/隐藏，右键菜单
4. **全局快捷键：** `Ctrl+Shift+T` 切换窗口显示/隐藏（可在设置中自定义）
5. **自启动：** 可选 Windows 开机自启，通过注册表管理
6. **主题：** 浅色/深色模式切换，即时持久化
7. **设置：** 通过 tauri-plugin-store 持久化存储
   - 默认源/目标语言
   - 置顶开关
   - 主题选择
   - 快捷键自定义（含格式校验）
   - 开机自启开关
   - 模拟模式开关
   - 百度 APP ID / Key 配置（本地存储，不上传 GitHub）

## 翻译 API（百度翻译）

- **接口：** `POST https://fanyi-api.baidu.com/api/trans/vip/translate`
- **认证：** MD5 签名 = `MD5(appid + 原文 + 随机数 + 密钥)`，表单字段提交
- **参数：** `q`（文本）、`from`、`to`、`appid`、`salt`、`sign`
- **返回：** `{"from": "zh", "to": "en", "trans_result": [{"src": "...", "dst": "..."}]}`
- **语言代码映射：** 内部代码（zh-Hans、ja、ko、fr、es、ar、vi）与百度代码（zh、jp、kor、fra、spa、ara、vie）互转
- **凭据：** 在设置界面中配置，通过 tauri-plugin-store 保存在本地应用数据目录 —— **绝不提交到 Git**

## 数据流

```
用户输入 → input 事件触发 → 500ms 防抖 → 调用 Tauri 命令 "translate_text"
→ Rust 后端：判断 mock/真实 API → POST 百度翻译 API / mock 查表
→ 返回 { translated_text, detected_language }
→ 翻译结果显示在右侧输出区域，状态栏显示"就绪"（含模拟模式标记）
```

## 界面布局（左右并排）

```
┌──────────────────────────────────────────────┐
│  Translate  📌  🌙  ⚙               −    ×   │  ← 无边框，标题栏可拖拽（38px）
│                                              │
│  源语言: [▼]           ⇄          目标语言: [▼] │
│  ┌────────────┐                  ┌──────────┐│
│  │  输入框     │                  │  输出框   ││
│  │         [×] │                  │     [📋]  ││  ← 清除/复制按钮 hover 显示
│  └────────────┘                  └──────────┘│
│                                              │
│                                      就绪    │  ← 状态栏（无分割线）
└──────────────────────────────────────────────┘
```

## Git 分支

- `main` — 脚手架 + CLAUDE.md + 全部修复
- `feat/backend` — Rust 后端（翻译、托盘、快捷键、自启、设置）
- `feat/frontend` — 前端 UI（布局、翻译交互、设置面板、主题）
- `fix/polish` — 联调修复与打磨
- `feat/baidu-api` — 从微软翻译切换到百度翻译 API

## 默认设置

```json
{
  "sourceLang": "auto",
  "targetLang": "en",
  "alwaysOnTop": true,
  "theme": "light",
  "shortcut": "Ctrl+Shift+T",
  "windowWidth": 620,
  "windowHeight": 380,
  "windowX": -1,
  "windowY": -1,
  "autoStart": false,
  "mockMode": false,
  "baiduAppId": "",
  "baiduKey": ""
}
```
