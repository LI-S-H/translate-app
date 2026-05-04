// Translation module — debounce, IPC calls, UI update
import { invoke } from "@tauri-apps/api/core";

let debounceTimer = null;
const DEBOUNCE_MS = 500;

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
 * Create the translator controller
 */
export function createTranslator() {
  const inputArea = document.getElementById("input-area");
  const outputArea = document.getElementById("output-area");
  const sourceSelect = document.getElementById("source-lang");
  const targetSelect = document.getElementById("target-lang");
  const swapBtn = document.getElementById("btn-swap");
  const detectedLangEl = document.getElementById("detected-lang");
  const statusText = document.getElementById("status-text");

  let isLoading = false;

  /**
   * Perform translation
   */
  async function doTranslate() {
    const text = inputArea.value;
    if (!text.trim()) {
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      detectedLangEl.textContent = "";
      statusText.textContent = "就绪";
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
      if (result.detected_language) {
        detectedLangEl.textContent = `检测: ${result.detected_language}`;
      }
      statusText.textContent = "就绪";
    } catch (err) {
      outputArea.innerHTML = `<span class="error-text">翻译失败: ${err}</span>`;
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
    if (src === "auto") {
      // Will be determined after detection
    } else {
      // Suggest target based on source
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

    // Don't swap if source is "auto"
    if (srcVal === "auto") {
      sourceSelect.value = tgtVal;
      // Don't change target
      debouncedTranslate();
      return;
    }

    sourceSelect.value = tgtVal;
    targetSelect.value = srcVal;

    // Swap text: output becomes input
    const outputText = outputArea.textContent;
    const isPlaceholder = outputArea.querySelector(".placeholder") || outputText === "翻译结果";

    if (!isPlaceholder && outputText.trim()) {
      inputArea.value = outputText;
      outputArea.innerHTML = '<span class="placeholder">翻译结果</span>';
      debouncedTranslate();
    }
  }

  // Wire events
  inputArea.addEventListener("input", debouncedTranslate);
  sourceSelect.addEventListener("change", onSourceChange);
  targetSelect.addEventListener("change", onTargetChange);
  swapBtn.addEventListener("click", onSwap);

  return {
    translate: doTranslate,
    refresh: debouncedTranslate,
  };
}
