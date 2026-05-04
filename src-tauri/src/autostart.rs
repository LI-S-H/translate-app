#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "windows")]
const RUN_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
#[cfg(target_os = "windows")]
const APP_NAME: &str = "TranslateApp";

#[cfg(target_os = "windows")]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(RUN_KEY_PATH, KEY_SET_VALUE)
        .map_err(|e| format!("Failed to open registry: {}", e))?;

    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let exe_str = exe_path.to_string_lossy().to_string();
        run_key
            .set_value(APP_NAME, &exe_str)
            .map_err(|e| format!("Failed to set registry value: {}", e))?;
    } else {
        // Try to delete; ignore error if key doesn't exist
        let _ = run_key.delete_value(APP_NAME);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn get_autostart() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(RUN_KEY_PATH, KEY_READ)
        .map_err(|e| format!("Failed to open registry: {}", e))?;

    match run_key.get_value::<String, _>(APP_NAME) {
        Ok(path) => {
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Failed to get exe path: {}", e))?;
            Ok(path == exe_path.to_string_lossy())
        }
        Err(_) => Ok(false),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_autostart(_enabled: bool) -> Result<(), String> {
    Err("Auto-start is only supported on Windows".into())
}

#[cfg(not(target_os = "windows"))]
pub fn get_autostart() -> Result<bool, String> {
    Ok(false)
}
