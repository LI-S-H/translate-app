// 自定义下拉组件 — 替换原生 <select>，统一金色主题
const LANG_OPTIONS = [
  { value: "auto",     label: "自动检测" },
  { value: "zh-Hans",  label: "中文" },
  { value: "en",       label: "English" },
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
];

/**
 * 将原生 <select> 替换为自定义下拉组件
 * @param {HTMLSelectElement} selectEl 原生 select 元素
 * @param {Array<{value:string, label:string}>} options 选项列表（可选，默认 LANG_OPTIONS）
 * @returns {{ setValue, getValue, container }}
 */
export function createDropdown(selectEl, options) {
  const opts = options || LANG_OPTIONS;
  const parent = selectEl.parentNode;

  // 隐藏原生 select
  selectEl.style.display = "none";

  // 构建容器
  const container = document.createElement("div");
  container.className = "custom-select";

  // 触发器
  const trigger = document.createElement("button");
  trigger.className = "custom-select-trigger";
  trigger.type = "button";
  trigger.innerHTML = `
    <span class="custom-select-value"></span>
    <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  `;
  const valueEl = trigger.querySelector(".custom-select-value");

  // 下拉面板
  const dropdown = document.createElement("div");
  dropdown.className = "custom-select-dropdown";

  // 构建选项
  function buildOptions() {
    dropdown.innerHTML = "";
    const selectedVal = selectEl.value;
    opts.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "custom-select-option";
      if (opt.value === selectedVal) item.classList.add("selected");
      item.dataset.value = opt.value;
      item.textContent = opt.label;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // 阻止 trigger 失焦
        selectOption(opt.value, opt.label);
      });
      dropdown.appendChild(item);
    });
    valueEl.textContent = opts.find((o) => o.value === selectedVal)?.label || opts[0].label;
  }

  function selectOption(value, label) {
    selectEl.value = value;
    valueEl.textContent = label;
    dropdown.querySelectorAll(".custom-select-option").forEach((o) => {
      o.classList.toggle("selected", o.dataset.value === value);
    });
    dropdown.classList.remove("open");
    // 触发原生 change 事件
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function toggle() {
    const isOpen = dropdown.classList.contains("open");
    // 关闭所有其他下拉
    document.querySelectorAll(".custom-select-dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!isOpen) {
      // 动态判断展开方向：下方空间不足时向上展开
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownHeight = 220;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      dropdown.classList.toggle("open-up", spaceBelow < dropdownHeight && triggerRect.top > dropdownHeight);
      dropdown.classList.add("open");
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  container.appendChild(trigger);
  container.appendChild(dropdown);
  parent.insertBefore(container, selectEl.nextSibling);

  buildOptions();

  // 点击外部关闭
  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });

  return {
    get value() { return selectEl.value; },
    set value(v) { selectEl.value = v; buildOptions(); },
    get container() { return container; },
    rebuild(opts2) {
      if (opts2) {
        opts.length = 0;
        opts.push(...opts2);
      }
      buildOptions();
    },
  };
}
