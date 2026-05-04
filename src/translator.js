// Translation module — debounce, IPC calls, UI update, clipboard
import { invoke } from "@tauri-apps/api/core";

const DEBOUNCE_MS = 500;
const MAX_CHARS = 5000;

/**
 * Debounce utility
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Determine default target language based on source language
 */
function defaultTarget(sourceLang) {
  if (sourceLang === "zh-Hans" || sourceLang === "zh") {
    return "en";
  }
  return "zh-Hans";
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create the translator controller
 */
export function createTranslator(settings) {
  const inputArea = document.getElementById("input-area");
  const outputArea = document.getElementById("output-area");
  const sourceSelect = document.getElementById("source-lang");
  const targetSelect = document.getElementById("target-lang");
  const swapBtn = document.getElementById("btn-swap");
  const detectedLangEl = document.getElementById("detected-lang");
  const statusText = document.getElementById("status-text");
  const charCountEl = document.getElementById("char-count");

  let isLoading = false;

  /**
   * Update character count
   */
  function updateCharCount() {
    const len = inputArea.value.length;
    if (charCountEl) {
      charCountEl.textContent = `${len}`;
      charCountEl.classList.toggle("over-limit", len > MAX_CHARS);
    }
  }

  /**
   * Perform translation
   */
  async function doTranslate() {
    const text = inputArea.value;
    updateCharCount();

    if (!text.trim()) {
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      outputArea.title = "";
      detectedLangEl.textContent = "";
      statusText.textContent = "就绪";
      return;
    }

    if (text.length > MAX_CHARS) {
      outputArea.innerHTML = `<span class="error-text">文本超过 ${MAX_CHARS} 字符限制</span>`;
      statusText.textContent = `超出限制`;
      return;
    }

    isLoading = true;
    statusText.innerHTML = '<span class="spinner"></span>翻译中...';

    const from = sourceSelect.value;
    const to = targetSelect.value;

    try {
      const result = await invoke("translate_text", {
        text,
        from,
        to,
      });

      outputArea.textContent = result.translated_text;
      outputArea.title = "点击复制到剪贴板";
      if (result.detected_language) {
        const langLabel = sourceSelect.options[sourceSelect.selectedIndex]?.text || result.detected_language;
        detectedLangEl.textContent = `检测: ${result.detected_language}`;
      }
      const mockText = settings?.mock_mode !== false ? " [MOCK]" : "";
      statusText.innerHTML = `就绪${mockText}`;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("Network") || msg.includes("fetch")) {
        outputArea.innerHTML = '<span class="error-text">网络错误，请检查连接后重试</span>';
      } else if (msg.includes("403") || msg.includes("401")) {
        outputArea.innerHTML = '<span class="error-text">API Key 无效，请在设置中配置</span>';
      } else {
        outputArea.innerHTML = `<span class="error-text">翻译失败: ${msg}</span>`;
      }
      statusText.textContent = "错误";
    } finally {
      isLoading = false;
    }
  }

  const debouncedTranslate = debounce(doTranslate, DEBOUNCE_MS);

  /**
   * Handle source language change — update target default
   */
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

  /**
   * Handle target language change
   */
  function onTargetChange() {
    debouncedTranslate();
  }

  /**
   * Swap source and target languages, and swap text
   */
  function onSwap() {
    const srcVal = sourceSelect.value;
    const tgtVal = targetSelect.value;

    if (srcVal === "auto") {
      sourceSelect.value = tgtVal;
      debouncedTranslate();
      return;
    }

    sourceSelect.value = tgtVal;
    targetSelect.value = srcVal;

    // Swap text: output becomes input
    const outputText = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const isDefault = outputText === "翻译结果";

    if (!hasPlaceholder && !isDefault && outputText.trim()) {
      inputArea.value = outputText;
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      updateCharCount();
      debouncedTranslate();
    }
  }

  /**
   * Copy output text to clipboard on click
   */
  async function onOutputClick() {
    const text = outputArea.textContent;
    const hasPlaceholder = outputArea.querySelector(".placeholder");
    const isError = outputArea.querySelector(".error-text");

    if (hasPlaceholder || isError || !text.trim()) return;

    const ok = await copyToClipboard(text);
    if (ok) {
      const orig = statusText.textContent;
      statusText.textContent = "已复制!";
      setTimeout(() => {
        if (statusText.textContent === "已复制!") {
          statusText.textContent = orig;
        }
      }, 1500);
    }
  }

  // Wire events
  inputArea.addEventListener("input", debouncedTranslate);
  sourceSelect.addEventListener("change", onSourceChange);
  targetSelect.addEventListener("change", onTargetChange);
  swapBtn.addEventListener("click", onSwap);
  outputArea.addEventListener("click", onOutputClick);
  outputArea.style.cursor = "pointer";

  return {
    translate: doTranslate,
    refresh: debouncedTranslate,
  };
}
