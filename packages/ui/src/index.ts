// 样式副作用导入
import "./styles.css";
import { ref, watchEffect } from "vue";

// 单例状态（所有组件共享）
const isDark = ref(false);
const theme = ref<string>(document.documentElement.dataset.theme || "slate");
const storageKey = "juanie-theme";
const storageModeKey = "juanie-theme-mode";

function setTheme(name: string) {
  theme.value = name;
  document.documentElement.dataset.theme = name;
  localStorage.setItem(storageKey, name);
}

function setDark(v: boolean) {
  isDark.value = !!v;
  localStorage.setItem(storageModeKey, isDark.value ? "dark" : "light");
}

function toggle() {
  setDark(!isDark.value);
}

function enableSystemMode() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => setDark(mq.matches);
  apply();
  mq.addEventListener("change", apply);
}

function loadPersisted() {
  const savedTheme = localStorage.getItem(storageKey);
  const savedMode = localStorage.getItem(storageModeKey);
  if (savedTheme) setTheme(savedTheme);
  if (savedMode === "dark") setDark(true);
  if (savedMode === "light") setDark(false);
}

watchEffect(() => {
  const el = document.documentElement;
  if (isDark.value) el.classList.add("dark");
  else el.classList.remove("dark");
  el.dataset.theme = theme.value;
});

// const api = {
//   isDark,
//   theme,
//   setTheme,
//   setDark,
//   toggle,
//   enableSystemMode,
//   loadPersisted,
//   // 运行时主题管理
//   registerTheme: (def: any) =>
//     import("./theme-registry").then((m) => m.registerTheme(def)),
//   exportTheme: (name: string) =>
//     import("./theme-registry").then((m) => m.exportTheme(name)),
//   listThemes: () => import("./theme-registry").then((m) => m.listThemes()),
//   removeTheme: (name: string) =>
//     import("./theme-registry").then((m) => m.removeTheme(name)),
//   importThemeJSON: (json: string) =>
//     import("./theme-registry").then((m) => m.importThemeJSON(json)),
//   exportThemeJSON: (name: string) =>
//     import("./theme-registry").then((m) => m.exportThemeJSON(name)),
//   copyThemeJSON: (name: string) =>
//     import("./theme-registry").then((m) => m.copyThemeJSON(name)),
//   // 颜色选择器：从主色生成主题并应用
//   applyPrimaryHex: async (hex: string) => {
//     const { hexToOklch, makeOklchPaletteFromPrimary } = await import(
//       "./color-utils"
//     );
//     const { registerTheme } = await import("./theme-registry");
//     const okl = hexToOklch(hex);
//     const palette = makeOklchPaletteFromPrimary(okl);
//     registerTheme({
//       name: "__custom__",
//       light: palette.light,
//       dark: palette.dark,
//     });
//     setTheme("__custom__");
//   },
// };

export type { OklchColor, RgbColor } from "./color-utils";
// 颜色工具
export {
  generateColorPalette,
  getContrastRatio,
  hexToOklch,
  isAccessible,
  oklchToString,
} from "./color-utils";
export type { ColorMode, ThemeName } from "./theme";
// 主题系统
export { BUILT_IN_THEMES, useTheme } from "./theme";

// 版本信息
export const version = "2.1.0";
