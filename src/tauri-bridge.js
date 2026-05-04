// Tauri IPC bridge — uses window.__TAURI_INTERNALS__ directly

const T = window.__TAURI_INTERNALS__;
const LABEL = "main";

function w(cmd, args = {}) {
  return T.invoke(`plugin:window|${cmd}`, { label: LABEL, ...args });
}

export function invoke(cmd, args = {}) {
  if (!T) return Promise.reject(new Error("Not in Tauri context"));
  return T.invoke(cmd, args);
}

export function getCurrentWindow() {
  return {
    minimize:       () => w("minimize"),
    maximize:       () => w("maximize"),
    unmaximize:     () => w("unmaximize"),
    close:          () => w("close"),
    show:           () => w("show"),
    hide:           () => w("hide"),
    setFocus:       () => w("set_focus"),
    isMaximized:    () => w("is_maximized"),
    isVisible:      () => w("is_visible"),
    outerSize:      () => w("outer_size"),
    outerPosition:  () => w("outer_position"),
    setAlwaysOnTop: (v) => w("set_always_on_top", { value: v }),
    startDragging:  () => w("start_dragging"),
    setPosition:    (pos) => w("set_position", { value: { x: pos.x, y: pos.y, type: "Logical" } }),
    onResized:  (cb) => { window.addEventListener("resize", cb); },
    onMoved:    (cb) => {
      let x = window.screenX, y = window.screenY;
      const id = setInterval(() => {
        if (window.screenX !== x || window.screenY !== y) {
          x = window.screenX; y = window.screenY; cb();
        }
      }, 500);
      return id;
    },
  };
}

export function LogicalPosition(x, y) {
  return { x, y, type: "Logical" };
}
