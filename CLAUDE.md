# CLAUDE.md

## Project: Translate App

A lightweight Windows desktop translation tool built with Tauri v2 + vanilla HTML/CSS/JS + Baidu Translate API.

## Tech Stack

- **Desktop Framework:** Tauri v2 (Rust backend + Web frontend)
- **Frontend:** Vanilla HTML/CSS/JS (ES modules, Vite dev server)
- **Backend:** Rust (Tauri commands, reqwest for HTTP)
- **Translation API:** Baidu Translate API (fanyi-api.baidu.com), with mock fallback
- **Packager:** npm, Cargo
- **Platform:** Windows 11 (primary target)

## Build Commands

```bash
npm install                 # Install frontend dependencies
npm run tauri dev           # Start dev server + Tauri window
npm run tauri build         # Production build → .msi/.exe
```

## Project Structure

```
translate-app/
├── index.html              # Entry HTML (mount point)
├── package.json            # npm deps & scripts
├── vite.config.js          # Vite bundler config
├── src/                    # Frontend source
│   ├── main.js             # App init, event wiring, IPC
│   ├── translator.js       # Debounce, translation logic
│   ├── settings.js         # Settings panel logic
│   └── styles.css          # Light + dark theme styles
├── src-tauri/              # Rust backend
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Window config, app metadata
│   ├── capabilities/default.json  # Security permissions
│   └── src/
│       ├── main.rs         # Desktop entry point (generated)
│       ├── lib.rs          # Tauri commands, plugins, tray, setup, state
│       ├── translator.rs   # Translation engine (mock + MS API), language detect
│       └── autostart.rs    # Windows registry auto-start management
└── dist/                   # Vite build output (for Tauri bundler)
```

## Frontend Modules

- **main.js** — App entry point. Loads settings, applies theme, initializes translator and settings modules, wires window controls (minimize/maximize/close/pin/theme).
- **translator.js** — Translation controller. Creates debounced input handler (500ms), calls `translate_text` Tauri command, updates output area, handles language selector changes and swap button.
- **settings.js** — Settings panel controller. Opens modal, populates fields from current settings, saves via `save_settings` command, notifies callback on change.
- **styles.css** — Complete light/dark theme via CSS custom properties. `[data-theme="dark"]` selector switches theme. Left-right flexbox layout.

## Feature Requirements

1. **Translation:** Dynamic translation as user types (debounce 500ms)
   - Default: Chinese input → English output; English/other → Chinese output
   - Manual language switching supported
   - Auto language detection
2. **Window:** 620×380, always-on-top, resizable, centered on launch
3. **System Tray:** Minimize to tray on close, left-click to show/hide, right-click menu
4. **Global Shortcut:** `Ctrl+Shift+T` to toggle window visibility (customizable)
5. **Auto-Start:** Optional Windows startup via registry key
6. **Theme:** Light/dark mode, persisted in settings
7. **Settings:** Persistent settings via tauri-plugin-store
   - Default source/target language
   - Always-on-top toggle
   - Theme selection
   - Shortcut customization
   - Auto-start toggle
   - Mock mode toggle
   - API key configuration

## Translation API (Baidu Translate)

- **Endpoint:** `POST https://fanyi-api.baidu.com/api/trans/vip/translate`
- **Auth:** MD5 signature: `MD5(appid + q + salt + key)`, sent as form fields
- **Parameters:** `q` (text), `from`, `to`, `appid`, `salt`, `sign`
- **Response:** `{"from": "zh", "to": "en", "trans_result": [{"src": "...", "dst": "..."}]}`
- **Language codes:** Our internal codes (zh-Hans, ja, ko, fr, es, ar, vi) mapped to Baidu codes (zh, jp, kor, fra, spa, ara, vie)
- **Credentials:** Configured in settings UI, stored locally via tauri-plugin-store — NEVER committed to git

## Data Flow

```
User types in textarea
  → input event fires
  → debounce 500ms (translator.js)
  → invoke Tauri command "translate" (IPC to Rust)
  → Rust: mock lookup or POST to MS Translator API
  → return { translated_text, detected_language }
  → display in output div
```

## UI Layout (Left-Right)

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

## Git Branches

- `main` — scaffold + CLAUDE.md (this file)
- `feat/backend` — Rust backend (translation, tray, shortcut, autostart, settings)
- `feat/frontend` — Frontend UI (layout, translation interaction, settings panel, theme)
- `fix/polish` — Integration fixes & polish

## Settings Defaults

```json
{
  "sourceLang": "auto",
  "targetLang": "en",
  "alwaysOnTop": true,
  "theme": "light",
  "shortcut": "Ctrl+Shift+T",
  "windowWidth": 620,
  "windowHeight": 380,
  "autoStart": false,
  "mockMode": false,
  "baiduAppId": "",
  "baiduKey": ""
}
```
