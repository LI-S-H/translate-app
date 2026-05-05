# Translate

桌面翻译工具，基于 [Tauri v2](https://v2.tauri.app/) + 百度翻译 API 构建，支持多语言互译。

![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![version](https://img.shields.io/badge/version-0.2.0-orange)

## 功能

- 中文 ↔ 英文及多语言实时翻译
- 自动检测源语言
- 窗口始终置顶，随用随走
- 系统托盘驻留，不占任务栏
- 全局快捷键 `Ctrl+Shift+T` 切换显示/隐藏
- 浅色 / 深色主题切换（平滑过渡）
- 开机自启选项
- 自定义翻译语言、快捷键
- 百度翻译 API 配置
- 暖金色主题 UI，Inter 字体，精致圆角设计

## 安装

1. 从 [Releases](https://github.com/LI-S-H/translate-app/releases) 下载最新 `Translate_0.2.0_x64_en-US.msi`
2. 双击安装即可

> 需要 Windows 10 或 Windows 11（自带 WebView2 运行时）。

### Windows SmartScreen 提示

因未购买代码签名证书（年费数千元），首次运行时可能被 SmartScreen 拦截：

1. 点击「**更多信息**」
2. 点击「**仍要运行**」

或下载 `.zip` 版本，解压后直接运行 `translate-app.exe`。

## 使用

| 操作 | 方式 |
|---|---|
| 翻译 | 左侧输入文字，右侧实时显示结果 |
| 切换语言 | 下拉框选择源语言 / 目标语言 |
| 交换语言 | 点击中间 ⇄ 按钮 |
| 复制结果 | 点击输出框左下角复制图标 |
| 清除输入 | 点击输入框右上角 ✕ 按钮 |
| 窗口置顶 | 点击标题栏 📌 图标（金色激活态） |
| 切换主题 | 点击标题栏 ☀/🌙 图标 |
| 设置 | 点击标题栏 ⚙ 图标，配置语言 / 快捷键 / API 等 |
| 退出程序 | 点击 ✕ 关闭按钮彻底退出 |

## 百度翻译 API 配置

1. 前往 [百度翻译开放平台](https://fanyi-api.baidu.com/) 注册并开通通用翻译 API
2. 获取 APP ID 和密钥
3. 在应用设置中填入 APP ID 和 Key，**取消 Mock 模式**即可使用真实翻译

> 不配置 API 时默认使用 Mock 翻译作为演示。

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（热更新）
npm run tauri dev

# 打包生产版本
npm run tauri build
```

## 技术栈

- **桌面框架** — Tauri v2（Rust 后端 + Web 前端）
- **前端** — 原生 HTML / CSS / JavaScript（ES 模块，Vite 构建）
- **翻译** — 百度翻译 API + Mock 回退
- **存储** — tauri-plugin-store 本地持久化
- **目标平台** — Windows 11 / 10

## 项目结构

```
├── index.html              # 入口 HTML
├── package.json            # 前端依赖与脚本
├── vite.config.js          # Vite 配置
├── src/                    # 前端源码
│   ├── main.js             # 应用入口
│   ├── tauri-bridge.js     # Tauri IPC 桥接
│   ├── translator.js       # 翻译模块
│   ├── settings.js         # 设置面板
│   ├── dropdown.js          # 自定义下拉组件
│   └── styles.css          # 主题样式（Inter 字体 + 暖金色调）
└── src-tauri/              # Rust 后端
    ├── Cargo.toml          # Rust 依赖
    ├── tauri.conf.json     # Tauri 窗口与打包配置
    └── src/
        ├── lib.rs          # Tauri 命令、托盘、快捷键、退出
        ├── translator.rs   # 翻译引擎（Mock + 百度 API）
        └── autostart.rs    # 开机自启管理
```
