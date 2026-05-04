// Translate App — Main Entry
import { invoke, getCurrentWindow, LogicalPosition } from "./tauri-bridge.js";
import { createTranslator } from "./translator.js";
import { createSettings } from "./settings.js";

// ===== State =====
let currentSettings = {
  source_lang: "auto",
  target_lang: "en",
  always_on_top: true,
  theme: "light",
  shortcut: "Ctrl+Shift+T",
  window_width: 620,
  window_height: 380,
  window_x: -1,
  window_y: -1,
  auto_start: false,
  mock_mode: false,
  baidu_app_id: "",
  baidu_key: "",
};

// ===== Theme =====
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("btn-theme");
  const isDark = theme === "dark";
  btn.querySelector(".icon-sun").style.display = isDark ? "" : "none";
  btn.querySelector(".icon-moon").style.display = isDark ? "none" : "";
  btn.title = isDark ? "切换浅色主题" : "切换深色主题";
}

function toggleTheme() {
  const newTheme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  applyTheme(newTheme);
  // Persist theme immediately
  currentSettings.theme = newTheme;
  invoke("save_settings", { newSettings: currentSettings }).catch((err) =>
    console.error("Failed to save theme:", err)
  );
}

// ===== Window Controls =====
async function setupWindowControls() {
  const win = getCurrentWindow();

  // Drag window by titlebar
  document.getElementById("titlebar").addEventListener("mousedown", (e) => {
    if (e.target.closest("button, select, input, textarea")) return;
    win.startDragging();
  });

  document.getElementById("btn-minimize").addEventListener("click", () => {
    win.minimize();
  });

  document.getElementById("btn-close").addEventListener("click", () => {
    win.close();
  });

  const pinBtn = document.getElementById("btn-pin");
  pinBtn.addEventListener("click", async () => {
    currentSettings.always_on_top = !currentSettings.always_on_top;
    await win.setAlwaysOnTop(currentSettings.always_on_top);
    pinBtn.classList.toggle("active", currentSettings.always_on_top);
    invoke("save_settings", { newSettings: currentSettings }).catch(() => {});
  });

  let saveTimer;
  async function saveWindowGeometry() {
    try {
      const size = await win.outerSize();
      const pos = await win.outerPosition();
      currentSettings.window_width = size.width;
      currentSettings.window_height = size.height;
      currentSettings.window_x = pos.x;
      currentSettings.window_y = pos.y;
      invoke("save_settings", { newSettings: currentSettings }).catch(() => {});
    } catch (_) {}
  }

  win.onResized(() => { clearTimeout(saveTimer); saveTimer = setTimeout(saveWindowGeometry, 1000); });
  win.onMoved(() => { clearTimeout(saveTimer); saveTimer = setTimeout(saveWindowGeometry, 1000); });
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load persisted settings
  try {
    currentSettings = await invoke("get_settings");
  } catch (err) {
    console.warn("Using default settings:", err);
  }

  // 2. Apply theme
  applyTheme(currentSettings.theme || "light");
  document
    .getElementById("btn-theme")
    .addEventListener("click", toggleTheme);

  // 3. Apply always-on-top state to pin button
  const pinBtn = document.getElementById("btn-pin");
  pinBtn.classList.toggle("active", currentSettings.always_on_top);

  // 4. Apply language defaults to selectors
  if (currentSettings.source_lang) {
    document.getElementById("source-lang").value =
      currentSettings.source_lang;
  }
  if (currentSettings.target_lang) {
    document.getElementById("target-lang").value =
      currentSettings.target_lang;
  }

  // 5. Setup translator with settings
  const translator = createTranslator(currentSettings);

  // 6. Setup settings panel
  createSettings((newSettings) => {
    // On settings save, update local state and UI
    currentSettings = { ...newSettings };

    // Update theme
    applyTheme(newSettings.theme);

    // Update language selectors
    document.getElementById("source-lang").value = newSettings.source_lang;
    document.getElementById("target-lang").value = newSettings.target_lang;

    // Update pin button
    document
      .getElementById("btn-pin")
      .classList.toggle("active", newSettings.always_on_top);

    // Update translator's settings reference
    currentSettings = { ...newSettings };
    translator.updateSettings(currentSettings);
    translator.refresh();
  });

  // 7. Restore window position if saved
  if (currentSettings.window_x > 0 || currentSettings.window_y > 0) {
    try {
      await getCurrentWindow().setPosition(
        new LogicalPosition(currentSettings.window_x, currentSettings.window_y)
      );
    } catch (_) {}
  }

  // 8. Setup window controls
  setupWindowControls();
});
