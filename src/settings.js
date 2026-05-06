// Settings panel module
import { invoke } from "./tauri-bridge.js";
import { createDropdown } from "./dropdown.js";

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
  const msgEl = document.getElementById("settings-msg");

  // 自定义下拉实例（open 时重建）
  let sourceDropdown = null;
  let targetDropdown = null;
  const targetLangOptions = LANG_OPTIONS.filter((o) => o.value !== "auto");

  function showMsg(text) {
    msgEl.textContent = text;
    msgEl.style.display = text ? "block" : "none";
  }

  function populateSelect(select, selectedValue, rebuildDropdown) {
    select.innerHTML = LANG_OPTIONS.map(
      (opt) =>
        `<option value="${opt.value}" ${
          opt.value === selectedValue ? "selected" : ""
        }>${opt.label}</option>`
    ).join("");
    if (rebuildDropdown) rebuildDropdown();
  }

  let cachedSettings = null;

  async function open() {
    showMsg("");

    // 先清理旧的自定义下拉 DOM
    if (sourceDropdown) sourceDropdown.container.remove();
    if (targetDropdown) targetDropdown.container.remove();

    overlay.classList.remove("hidden");

    try {
      const settings = await invoke("get_settings");
      cachedSettings = { ...settings };

      populateSelect(selectSource, settings.source_lang);
      selectTarget.innerHTML = targetLangOptions
        .map(
          (opt) =>
            `<option value="${opt.value}" ${
              opt.value === settings.target_lang ? "selected" : ""
            }>${opt.label}</option>`
        )
        .join("");

      // 创建自定义下拉
      sourceDropdown = createDropdown(selectSource, LANG_OPTIONS);
      targetDropdown = createDropdown(selectTarget, targetLangOptions);

      inputShortcut.value = settings.shortcut || "Ctrl+Shift+T";
      inputShortcut.readOnly = true;
      inputShortcut.placeholder = "点击后按下组合键...";
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

  // 快捷键按键捕获
  inputShortcut.addEventListener("keydown", (e) => {
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    const key = e.key;
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) return;

    parts.push(key.length === 1 ? key.toUpperCase() : key);
    inputShortcut.value = parts.join("+");
  });

  btnSettings.addEventListener("click", open);
  btnSave.addEventListener("click", save);
  btnCancel.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, close };
}
