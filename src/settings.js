// Settings panel module
import { invoke } from "./tauri-bridge.js";

const LANG_OPTIONS = [
  { value: "auto", label: "自动检测" },
  { value: "zh-Hans", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "ru", label: "Русский" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ar", label: "العربية" },
  { value: "th", label: "ไทย" },
  { value: "vi", label: "Tiếng Việt" },
];

// Simple shortcut validation: must contain a modifier + key
const SHORTCUT_RE = /^(Ctrl|Alt|Shift|Super)(\+(Ctrl|Alt|Shift|Super))*\+[A-Z0-9]$/i;

function validateShortcut(val) {
  if (!val) return true; // will use default
  return SHORTCUT_RE.test(val);
}

export function createSettings(onSettingsChanged) {
  const overlay = document.getElementById("settings-overlay");
  const btnSettings = document.getElementById("btn-settings");
  const btnSave = document.getElementById("btn-save-settings");
  const btnCancel = document.getElementById("btn-cancel-settings");
  const selectSource = document.getElementById("set-source-lang");
  const selectTarget = document.getElementById("set-target-lang");
  const inputShortcut = document.getElementById("set-shortcut");
  const inputAutostart = document.getElementById("set-autostart");
  const inputMock = document.getElementById("set-mock");
  const inputBaiduAppId = document.getElementById("set-baidu-appid");
  const inputBaiduKey = document.getElementById("set-baidu-key");
  const btnToggleKey = document.getElementById("btn-toggle-key");
  const msgEl = document.getElementById("settings-msg");

  function showMsg(text) {
    msgEl.textContent = text;
    msgEl.style.display = text ? "block" : "none";
  }

  function populateSelect(select, selectedValue) {
    select.innerHTML = LANG_OPTIONS.map(
      (opt) =>
        `<option value="${opt.value}" ${
          opt.value === selectedValue ? "selected" : ""
        }>${opt.label}</option>`
    ).join("");
  }

  let cachedSettings = null;

  async function open() {
    showMsg("");
    populateSelect(selectSource, "auto");
    const targetOptions = LANG_OPTIONS.filter((o) => o.value !== "auto");
    selectTarget.innerHTML = targetOptions
      .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
      .join("");
    // Reset key visibility
    inputBaiduKey.type = "password";
    btnToggleKey.innerHTML = "&#128065;";
    overlay.classList.remove("hidden");

    try {
      const settings = await invoke("get_settings");
      cachedSettings = { ...settings };

      populateSelect(selectSource, settings.source_lang);
      selectTarget.innerHTML = targetOptions
        .map(
          (opt) =>
            `<option value="${opt.value}" ${
              opt.value === settings.target_lang ? "selected" : ""
            }>${opt.label}</option>`
        )
        .join("");

      inputShortcut.value = settings.shortcut || "Ctrl+Shift+T";
      inputAutostart.checked = settings.auto_start || false;
      inputMock.checked = settings.mock_mode !== false;
      inputBaiduAppId.value = settings.baidu_app_id || "";
      inputBaiduKey.value = settings.baidu_key || "";
    } catch (err) {
      showMsg("加载设置失败: " + String(err));
    }
  }

  function close() {
    overlay.classList.add("hidden");
  }

  async function save() {
    // Validate shortcut
    if (!validateShortcut(inputShortcut.value)) {
      showMsg("快捷键格式错误，请使用类似 Ctrl+Shift+T 的格式");
      return;
    }

    showMsg("");
    try {
      const newSettings = {
        source_lang: selectSource.value,
        target_lang: selectTarget.value,
        always_on_top: cachedSettings?.always_on_top ?? true,
        theme: cachedSettings?.theme ?? "light",
        shortcut: inputShortcut.value || "Ctrl+Shift+T",
        window_width: cachedSettings?.window_width ?? 620,
        window_height: cachedSettings?.window_height ?? 380,
        window_x: cachedSettings?.window_x ?? -1,
        window_y: cachedSettings?.window_y ?? -1,
        auto_start: inputAutostart.checked,
        mock_mode: inputMock.checked,
        baidu_app_id: inputBaiduAppId.value,
        baidu_key: inputBaiduKey.value,
      };

      await invoke("save_settings", { newSettings });

      if (onSettingsChanged) {
        onSettingsChanged(newSettings);
      }

      close();
    } catch (err) {
      showMsg("保存失败: " + String(err));
    }
  }

  // Toggle key visibility
  btnToggleKey.addEventListener("click", () => {
    if (inputBaiduKey.type === "password") {
      inputBaiduKey.type = "text";
      btnToggleKey.innerHTML = "&#128064;"; // eye-slash
    } else {
      inputBaiduKey.type = "password";
      btnToggleKey.innerHTML = "&#128065;"; // eye
    }
  });

  btnSettings.addEventListener("click", open);
  btnSave.addEventListener("click", save);
  btnCancel.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, close };
}
