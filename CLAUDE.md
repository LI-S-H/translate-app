# CLAUDE.md

## 项目：Translate App

Windows 桌面翻译工具，基于 Tauri v2 + 原生 HTML/CSS/JS + 百度翻译 API。

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
│   ├── main.js             # 应用入口：初始化、事件绑定、IPC 调用
│   ├── translator.js       # 翻译模块：防抖、翻译逻辑、剪贴板
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

- **main.js** — 应用入口。加载持久化设置、应用主题、初始化翻译和设置模块、绑定窗口控制（最小化/最大化/关闭/置顶/主题切换）、窗口大小和位置自动保存。
- **translator.js** — 翻译控制器。输入事件防抖 500ms 后调用 `translate_text` 命令，更新输出区域，处理语言切换和交换按钮，点击输出区域复制到剪贴板（带闪烁动画反馈），模拟模式状态显示。
- **settings.js** — 设置面板控制器。打开弹窗、从后端加载设置填入表单、保存时校验快捷键格式、通过 `save_settings` 命令持久化，变更后回调通知主模块刷新 UI。支持百度 Key 显隐切换。
- **styles.css** — 完整浅色/深色主题，通过 CSS 变量和 `[data-theme="dark"]` 选择器切换。左右 Flexbox 布局。标题栏和状态栏禁用文本选择，输入输出区域允许选择。

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
→ 显示在右侧输出区域
```

## 界面布局（左右并排）

```
┌──────────────────────────────────────────────────┐
│  [📌 置顶] [🌙 主题] [⚙ 设置]       [─] [□] [×] │
│──────────────────────────────────────────────────│
│   源语言: [▼]      ⇄      目标语言: [▼]          │
│   ┌─────────────┐        ┌─────────────┐        │
│   │  输入框      │        │  输出框      │        │
│   └─────────────┘        └─────────────┘        │
└──────────────────────────────────────────────────┘
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
