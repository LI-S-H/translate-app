// Translation module — debounce, IPC calls, UI update, clipboard
import { invoke } from "./tauri-bridge.js";
import { createDropdown } from "./dropdown.js";

const DEBOUNCE_MS = 500;
const MAX_CHARS = 5000;

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function defaultTarget(sourceLang) {
  if (sourceLang === "zh-Hans" || sourceLang === "zh") return "en";
  return "zh-Hans";
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

export function createTranslator(settings) {
  const appSettings = { current: settings };
  const inputArea = document.getElementById("input-area");
  const outputArea = document.getElementById("output-area");
  const sourceSelect = document.getElementById("source-lang");
  const targetSelect = document.getElementById("target-lang");
  const swapBtn = document.getElementById("btn-swap");
  const statusText = document.getElementById("status-text");
  const clearBtn = document.getElementById("btn-clear");
  const copyBtn = document.getElementById("btn-copy");

  let isLoading = false;
  let pendingTranslation = null;

  function updateClearBtn() {
    if (clearBtn) clearBtn.classList.toggle("hidden", inputArea.value.length === 0);
  }

  function updateCopyBtn() {
    const text = outputArea.textContent || "";
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const hasError = outputArea.querySelector(".error-text");
    if (copyBtn) copyBtn.classList.toggle("hidden", hasPlaceholder || hasError || !text.trim());
  }

  async function doTranslate() {
    const text = inputArea.value;
    updateClearBtn();

    if (!text.trim()) {
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      statusText.textContent = "就绪";
      updateCopyBtn();
      return;
    }

    if (text.length > MAX_CHARS) {
      outputArea.innerHTML = `<span class="error-text">文本超过 ${MAX_CHARS} 字符限制</span>`;
      statusText.textContent = "超出限制";
      return;
    }

    if (isLoading) {
      pendingTranslation = { text: inputArea.value, from: sourceSelect.value, to: targetSelect.value };
      return;
    }

    isLoading = true;
    statusText.innerHTML = '<span class="spinner"></span>翻译中...';

    const from = sourceSelect.value;
    const to = targetSelect.value;

    try {
      const result = await invoke("translate_text", { text, from, to });
      outputArea.textContent = result.translated_text;
      const mockText = appSettings.current.mock_mode ? " [模拟]" : "";
      statusText.textContent = `就绪${mockText}`;
      updateCopyBtn();
    } catch (err) {
      const msg = String(err);
      if (msg.includes("Network") || msg.includes("fetch")) {
        outputArea.innerHTML = '<span class="error-text">网络错误，请检查连接后重试</span>';
      } else if (msg.includes("403") || msg.includes("401") || msg.includes("5200")) {
        outputArea.innerHTML = '<span class="error-text">API 认证失败，请在设置中检查 APP ID 和 Key</span>';
      } else {
        outputArea.innerHTML = `<span class="error-text">翻译失败: ${msg}</span>`;
      }
      statusText.textContent = "错误";
      updateCopyBtn();
    } finally {
      isLoading = false;
      // If pending input changed while loading, run another translation
      if (pendingTranslation) {
        pendingTranslation = null;
        doTranslate();
      }
    }
  }

  const debouncedTranslate = debounce(doTranslate, DEBOUNCE_MS);

  function onSourceChange() {
    const src = sourceSelect.value;
    if (src !== "auto") {
      const suggested = defaultTarget(src);
      if (targetSelect.value === src || targetSelect.value === "auto") {
        targetSelect.value = suggested;
      }
    }
    debouncedTranslate();
  }

  function onTargetChange() {
    debouncedTranslate();
  }

  function onSwap() {
    const srcVal = sourceSelect.value;
    const tgtVal = targetSelect.value;

    if (srcVal === "auto") {
      sourceSelect.value = tgtVal;
      targetSelect.value = defaultTarget(tgtVal);
    } else {
      sourceSelect.value = tgtVal;
      targetSelect.value = srcVal;
    }
    // 同步自定义下拉显示
    sourceDropdown.value = sourceSelect.value;
    targetDropdown.value = targetSelect.value;

    // Swap text: output becomes input
    const outputText = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const hasError = outputArea.querySelector(".error-text");
    const isDefault = outputText === "翻译结果";

    if (!hasPlaceholder && !hasError && !isDefault && outputText.trim()) {
      inputArea.value = outputText;
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      updateClearBtn();
    }
    debouncedTranslate();
  }

  async function onCopyClick() {
    const text = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const hasError = outputArea.querySelector(".error-text");
    if (hasPlaceholder || hasError || !text.trim()) return;

    const ok = await copyToClipboard(text);
    if (ok) {
      copyBtn.classList.remove("flash");
      void copyBtn.offsetWidth;
      copyBtn.classList.add("flash");
      copyBtn.addEventListener("animationend", () => copyBtn.classList.remove("flash"), { once: true });
      statusText.textContent = "已复制";
      setTimeout(() => {
        if (statusText.textContent === "已复制") statusText.textContent = "就绪";
      }, 500);
    }
  }

  // 初始化自定义下拉菜单
  const sourceDropdown = createDropdown(sourceSelect);
  const targetDropdown = createDropdown(targetSelect, [
    { value: "en",       label: "English" },
    { value: "zh-Hans",  label: "中文" },
    { value: "ja",       label: "日本語" },
    { value: "ko",       label: "한국어" },
    { value: "fr",       label: "Français" },
    { value: "de",       label: "Deutsch" },
    { value: "es",       label: "Español" },
    { value: "ru",       label: "Русский" },
    { value: "pt",       label: "Português" },
    { value: "it",       label: "Italiano" },
    { value: "ar",       label: "العربية" },
    { value: "th",       label: "ไทย" },
    { value: "vi",       label: "Tiếng Việt" },
  ]);

  // Wire events
  inputArea.addEventListener("input", debouncedTranslate);
  sourceSelect.addEventListener("change", onSourceChange);
  targetSelect.addEventListener("change", onTargetChange);
  swapBtn.addEventListener("click", onSwap);

  clearBtn.addEventListener("click", () => {
    inputArea.value = "";
    outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
    statusText.textContent = "就绪";
    updateClearBtn();
    updateCopyBtn();
  });

  copyBtn.addEventListener("click", onCopyClick);

  function fillAndTranslate(text) {
    inputArea.value = text;
    updateClearBtn();
    doTranslate();
  }

  return {
    translate: doTranslate,
    refresh: debouncedTranslate,
    updateSettings: (s) => { appSettings.current = s; },
    fillAndTranslate,
  };
}
