// Tauri IPC bridge — uses native Tauri globals directly
// Avoids Vite pre-bundling breaking @tauri-apps/api imports

const T = window.__TAURI_INTERNALS__;

/** Call a Tauri command */
export function invoke(cmd, args = {}) {
  if (!T) return Promise.reject(new Error("Not in Tauri context"));
  return T.invoke(cmd, args);
}

/** Minimal window API wrapper using Tauri internals */
export function getCurrentWindow() {
  const win = T?.windows?.[0];
  return {
    minimize: () => T.invoke("plugin:window|minimize"),
    maximize: () => T.invoke("plugin:window|maximize"),
    unmaximize: () => T.invoke("plugin:window|unmaximize"),
    close: () => T.invoke("plugin:window|close"),
    setAlwaysOnTop: (v) => T.invoke("plugin:window|set_always_on_top", { alwaysOnTop: v }),
    isMaximized: () => T.invoke("plugin:window|is_maximized"),
    isVisible: () => T.invoke("plugin:window|is_visible"),
    show: () => T.invoke("plugin:window|show"),
    hide: () => T.invoke("plugin:window|hide"),
    setFocus: () => T.invoke("plugin:window|set_focus"),
    outerSize: () => T.invoke("plugin:window|outer_size"),
    outerPosition: () => T.invoke("plugin:window|outer_position"),
    setPosition: (pos) => T.invoke("plugin:window|set_position", { position: { x: pos.x, y: pos.y, type: "Logical" } }),
    onResized: (cb) => { window.addEventListener("resize", cb); },
    onMoved: (cb) => {
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
