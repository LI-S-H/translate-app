// Translate App — Main Entry
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
  auto_start: false,
  mock_mode: false,
  baidu_app_id: "",
  baidu_key: "",
};

// ===== Theme =====
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("btn-theme");
  btn.innerHTML = theme === "dark" ? "&#9728;" : "&#127769;"; // sun / moon
  btn.title = theme === "dark" ? "切换浅色主题" : "切换深色主题";
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

  document.getElementById("btn-minimize").addEventListener("click", () => {
    win.minimize();
  });

  document.getElementById("btn-maximize").addEventListener("click", async () => {
    const maximized = await win.isMaximized();
    if (maximized) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  document.getElementById("btn-close").addEventListener("click", () => {
    win.close(); // Backend intercepts CloseRequested → hides to tray
  });

  // Always-on-top toggle (pin button)
  const pinBtn = document.getElementById("btn-pin");
  pinBtn.addEventListener("click", async () => {
    currentSettings.always_on_top = !currentSettings.always_on_top;
    await win.setAlwaysOnTop(currentSettings.always_on_top);
    pinBtn.classList.toggle("active", currentSettings.always_on_top);
    // Persist
    invoke("save_settings", { newSettings: currentSettings }).catch((err) =>
      console.error("Failed to save pin:", err)
    );
  });

  // Save window size on resize
  let resizeTimer;
  win.onResized(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      try {
        const size = await win.outerSize();
        currentSettings.window_width = size.width;
        currentSettings.window_height = size.height;
        invoke("save_settings", { newSettings: currentSettings }).catch(
          () => {}
        );
      } catch (_) {
        // Ignore resize errors
      }
    }, 1000);
  });
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
    translator.refresh();
  });

  // 7. Setup window controls
  setupWindowControls();
});
