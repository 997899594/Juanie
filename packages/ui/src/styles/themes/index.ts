import type { ThemeConfig, ThemeMode } from "../../types";

// 主题元数据定义
export const BUILTIN_THEMES: ThemeConfig[] = [
  { name: "default", displayName: "默认", mode: "light", group: "default" },
  {
    name: "default-dark",
    displayName: "默认暗色",
    mode: "dark",
    group: "default",
  },
  { name: "bilibili", displayName: "B站", mode: "light", group: "bilibili" },
  {
    name: "bilibili-dark",
    displayName: "B站暗色",
    mode: "dark",
    group: "bilibili",
  },
  { name: "notion", displayName: "Notion", mode: "light", group: "notion" },
  {
    name: "notion-dark",
    displayName: "Notion暗色",
    mode: "dark",
    group: "notion",
  },
];

export const THEME_GROUPS = {
  default: { name: "default", displayName: "默认主题" },
  bilibili: { name: "bilibili", displayName: "B站主题" },
  notion: { name: "notion", displayName: "Notion主题" },
} as const;

export type ThemeGroup = keyof typeof THEME_GROUPS;

// 获取当前主题
export function getCurrentTheme(): ThemeConfig | null {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const themeAttr = root.getAttribute("data-theme");

  if (themeAttr) {
    const themeName = isDark ? `${themeAttr}-dark` : themeAttr;
    return BUILTIN_THEMES.find((t) => t.name === themeName) || null;
  }

  // 修复类型比较错误
  const defaultThemeName = isDark ? "default-dark" : "default";
  return BUILTIN_THEMES.find((t) => t.name === defaultThemeName) || null;
}

// 获取主题分组
export function getThemeGroups() {
  return Object.values(THEME_GROUPS);
}

// 根据分组获取主题
export function getThemesByGroup(group: ThemeGroup): ThemeConfig[] {
  return BUILTIN_THEMES.filter((theme) => theme.group === group);
}

// 设置主题 - 修复逻辑
export function setTheme(themeName: string): boolean {
  // 如果传入的是组名，转换为具体主题名
  let targetTheme = BUILTIN_THEMES.find((t) => t.name === themeName);

  // 如果没找到，尝试作为组名处理
  if (!targetTheme) {
    const group = themeName as ThemeGroup;
    if (THEME_GROUPS[group]) {
      // 检查当前是否为暗色模式
      const isDark = document.documentElement.classList.contains("dark");
      const themeMode = isDark ? "dark" : "light";
      targetTheme = BUILTIN_THEMES.find(
        (t) => t.group === group && t.mode === themeMode
      );

      // 如果没找到对应模式的主题，使用该组的亮色主题
      if (!targetTheme) {
        targetTheme = BUILTIN_THEMES.find(
          (t) => t.group === group && t.mode === "light"
        );
      }
    }
  }

  if (!targetTheme) {
    console.warn(`Theme "${themeName}" not found`);
    return false;
  }

  const root = document.documentElement;

  // 移除所有主题相关的类和属性
  root.classList.remove("dark");
  root.removeAttribute("data-theme");

  // 应用新主题
  if (targetTheme.mode === "dark") {
    root.classList.add("dark");
  }

  if (targetTheme.group !== "default") {
    root.setAttribute("data-theme", targetTheme.group);
  }

  // 保存到 localStorage
  localStorage.setItem("theme", targetTheme.name);

  return true;
}

// 恢复主题（从 localStorage）
export function restoreTheme(): string {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme && setTheme(savedTheme)) {
    return savedTheme;
  }

  // 如果没有保存的主题，使用系统偏好
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const defaultTheme = prefersDark ? "default-dark" : "default";
  setTheme(defaultTheme);
  return defaultTheme;
}

// 切换同组内的亮色/暗色模式
export function toggleThemeMode(): string {
  const currentTheme = getCurrentTheme();
  if (!currentTheme) return "default";

  const targetMode: ThemeMode =
    currentTheme.mode === "light" ? "dark" : "light";
  const targetTheme = BUILTIN_THEMES.find(
    (t) => t.group === currentTheme.group && t.mode === targetMode
  );

  if (targetTheme) {
    setTheme(targetTheme.name);
    return targetTheme.name;
  }

  return currentTheme.name;
}

// 获取 CSS 变量值（用于 JavaScript 中访问主题颜色）
export function getCSSVariable(variable: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${variable}`)
    .trim();
}

// 检查是否为暗色主题
export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

// 导出类型
export type { ThemeConfig, ThemeMode };

// 建议添加主题验证和错误处理
// export function validateTheme(theme: ThemeConfig): boolean {
//   // 主题配置验证逻辑
//   return true
// }

export function createCustomTheme(config: Partial<ThemeConfig>): ThemeConfig {
  // 自定义主题创建工具
  const defaultConfig: ThemeConfig = {
    name: "custom",
    displayName: "自定义",
    mode: "light",
    group: "custom",
  };
  return { ...defaultConfig, ...config };
}
