// Translation module — debounce, IPC calls, UI update, clipboard
import { invoke } from "@tauri-apps/api/core";

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
  const detectedLangEl = document.getElementById("detected-lang");
  const statusText = document.getElementById("status-text");
  const charCountEl = document.getElementById("char-count");

  let isLoading = false;
  let pendingTranslation = null;

  function updateCharCount() {
    const len = inputArea.value.length;
    if (charCountEl) {
      charCountEl.textContent = String(len);
      charCountEl.classList.toggle("over-limit", len > MAX_CHARS);
    }
  }

  async function doTranslate() {
    const text = inputArea.value;
    updateCharCount();

    if (!text.trim()) {
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      outputArea.style.cursor = "default";
      outputArea.title = "";
      detectedLangEl.textContent = "";
      statusText.textContent = "就绪";
      return;
    }

    if (text.length > MAX_CHARS) {
      outputArea.innerHTML = `<span class="error-text">文本超过 ${MAX_CHARS} 字符限制</span>`;
      statusText.textContent = "超出限制";
      return;
    }

    // Skip if already loading — debounce will retrigger after current finishes
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
      outputArea.style.cursor = "pointer";
      outputArea.title = "点击复制到剪贴板";
      if (result.detected_language) {
        detectedLangEl.textContent = `检测: ${result.detected_language}`;
      }
      const mockText = appSettings.current.mock_mode ? " [模拟]" : "";
      statusText.textContent = `就绪${mockText}`;
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
      // When source is auto, set source = target, target = auto's default
      sourceSelect.value = tgtVal;
      targetSelect.value = defaultTarget(tgtVal);
    } else {
      sourceSelect.value = tgtVal;
      targetSelect.value = srcVal;
    }

    // Swap text: output becomes input
    const outputText = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const hasError = outputArea.querySelector(".error-text");
    const isDefault = outputText === "翻译结果";

    if (!hasPlaceholder && !hasError && !isDefault && outputText.trim()) {
      inputArea.value = outputText;
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      outputArea.style.cursor = "default";
      detectedLangEl.textContent = "";
      updateCharCount();
    }
    debouncedTranslate();
  }

  async function onOutputClick() {
    const text = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const hasError = outputArea.querySelector(".error-text");

    if (hasPlaceholder || hasError || !text.trim()) return;

    const ok = await copyToClipboard(text);
    if (ok) {
      outputArea.classList.add("copied-flash");
      statusText.textContent = "已复制!";
      setTimeout(() => {
        outputArea.classList.remove("copied-flash");
        if (statusText.textContent === "已复制!") {
          statusText.textContent = "就绪";
        }
      }, 1200);
    }
  }

  // Wire events
  inputArea.addEventListener("input", debouncedTranslate);
  sourceSelect.addEventListener("change", onSourceChange);
  targetSelect.addEventListener("change", onTargetChange);
  swapBtn.addEventListener("click", onSwap);
  outputArea.addEventListener("click", onOutputClick);

  return {
    translate: doTranslate,
    refresh: debouncedTranslate,
    updateSettings: (s) => { appSettings.current = s; },
  };
}
