mod autostart;
mod translator;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use tauri_plugin_store::StoreExt;
use translator::{translate, Settings, TranslationResult};

/// In-memory settings cache, synced with persistent store
struct AppState {
    settings: Mutex<Settings>,
}

// ===== Tauri Commands =====

#[tauri::command]
async fn translate_text(
    text: String,
    from: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<TranslationResult, String> {
    let (mock_mode, baidu_app_id, baidu_key) = {
        let settings = state.settings.lock().map_err(|e| format!("锁定设置失败: {}", e))?;
        (settings.mock_mode, settings.baidu_app_id.clone(), settings.baidu_key.clone())
    };
    translate(text, from, to, mock_mode, baidu_app_id, baidu_key).await
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let settings = state.settings.lock().map_err(|e| format!("锁定设置失败: {}", e))?;
    Ok(settings.clone())
}

#[tauri::command]
fn save_settings(
    new_settings: Settings,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Update in-memory state
    {
        let mut settings = state.settings.lock().map_err(|e| format!("锁定设置失败: {}", e))?;
        *settings = new_settings.clone();
    }

    // Persist to store — save() is the only method that returns Result
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Store error: {}", e))?;
    let _ = store.set("sourceLang", new_settings.source_lang.clone());
    let _ = store.set("targetLang", new_settings.target_lang.clone());
    let _ = store.set("alwaysOnTop", new_settings.always_on_top);
    let _ = store.set("theme", new_settings.theme.clone());
    let _ = store.set("shortcut", new_settings.shortcut.clone());
    let _ = store.set("windowWidth", new_settings.window_width);
    let _ = store.set("windowHeight", new_settings.window_height);
    let _ = store.set("windowX", new_settings.window_x);
    let _ = store.set("windowY", new_settings.window_y);
    let _ = store.set("autoStart", new_settings.auto_start);
    let _ = store.set("mockMode", new_settings.mock_mode);
    let _ = store.set("baiduAppId", new_settings.baidu_app_id.clone());
    let _ = store.set("baiduKey", new_settings.baidu_key.clone());
    store.save().map_err(|e| format!("写入设置文件失败: {}", e))?;

    // Apply always-on-top
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(new_settings.always_on_top);
    }

    // Apply auto-start
    if new_settings.auto_start {
        let _ = autostart::set_autostart(true);
    } else {
        let _ = autostart::set_autostart(false);
    }

    Ok(())
}

#[tauri::command]
fn get_autostart_status() -> Result<bool, String> {
    autostart::get_autostart()
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// ===== App Entry Point =====

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["Ctrl+Shift+T"])
                .unwrap()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if shortcut.matches(
                            tauri_plugin_global_shortcut::Modifiers::CONTROL
                                | tauri_plugin_global_shortcut::Modifiers::SHIFT,
                            tauri_plugin_global_shortcut::Code::KeyT,
                        ) {
                            if let Some(win) = app.get_webview_window("main") {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(AppState {
            settings: Mutex::new(Settings::default()),
        })
        .setup(|app| {
            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "显示/隐藏", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::new();
            if let Some(icon) = icon {
                tray_builder = tray_builder.icon(icon);
            }
            let _tray = tray_builder
                .menu(&menu)
                .tooltip("Translate")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Load persisted settings into memory
            let store = app.store("settings.json")?;
            let state = app.state::<AppState>();
            let mut settings = state.settings.lock().map_err(|e| format!("启动加载设置失败: {}", e))?;

            if let Some(val) = store.get("sourceLang") {
                settings.source_lang = val.as_str().unwrap_or("auto").to_string();
            }
            if let Some(val) = store.get("targetLang") {
                settings.target_lang = val.as_str().unwrap_or("en").to_string();
            }
            if let Some(val) = store.get("alwaysOnTop") {
                settings.always_on_top = val.as_bool().unwrap_or(true);
            }
            if let Some(val) = store.get("theme") {
                settings.theme = val.as_str().unwrap_or("light").to_string();
            }
            if let Some(val) = store.get("shortcut") {
                settings.shortcut = val.as_str().unwrap_or("Ctrl+Shift+T").to_string();
            }
            if let Some(val) = store.get("windowWidth") {
                settings.window_width = val.as_f64().unwrap_or(620.0);
            }
            if let Some(val) = store.get("windowHeight") {
                settings.window_height = val.as_f64().unwrap_or(380.0);
            }
            if let Some(val) = store.get("windowX") {
                settings.window_x = val.as_f64().unwrap_or(-1.0);
            }
            if let Some(val) = store.get("windowY") {
                settings.window_y = val.as_f64().unwrap_or(-1.0);
            }
            if let Some(val) = store.get("autoStart") {
                settings.auto_start = val.as_bool().unwrap_or(false);
            }
            if let Some(val) = store.get("mockMode") {
                settings.mock_mode = val.as_bool().unwrap_or(true);
            }
            if let Some(val) = store.get("baiduAppId") {
                settings.baidu_app_id = val.as_str().unwrap_or("").to_string();
            }
            if let Some(val) = store.get("baiduKey") {
                settings.baidu_key = val.as_str().unwrap_or("").to_string();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide to tray instead of closing; ignore error if hide fails
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            translate_text,
            get_settings,
            save_settings,
            get_autostart_status,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
