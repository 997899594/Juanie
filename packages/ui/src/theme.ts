import { readonly, ref, watchEffect } from "vue";

// 内置主题定义
export const BUILT_IN_THEMES = {
  slate: {
    name: "Slate",
    description: "经典灰色主题，适合专业应用",
  },
  notion: {
    name: "Notion",
    description: "简洁中性主题，适合内容创作",
  },
  bilibili: {
    name: "Bilibili",
    description: "品牌粉色主题，活泼现代",
  },
} as const;

export type ThemeName = keyof typeof BUILT_IN_THEMES;
export type ColorMode = "light" | "dark" | "system";

// 主题状态管理
const currentTheme = ref<ThemeName>("slate");
const colorMode = ref<ColorMode>("system");
const isDark = ref(false);

// 存储键
const THEME_STORAGE_KEY = "juanie-theme";
const MODE_STORAGE_KEY = "juanie-color-mode";

// 系统暗色模式检测
let mediaQuery: MediaQueryList | null = null;

function updateSystemDark() {
  if (colorMode.value === "system") {
    isDark.value = mediaQuery?.matches ?? false;
  }
}

function initSystemMode() {
  if (typeof window === "undefined") return;

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", updateSystemDark);
  updateSystemDark();
}

// DOM 更新
watchEffect(() => {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  html.dataset.theme = currentTheme.value;

  if (isDark.value) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
});

// 主题 API
export function useTheme() {
  return {
    // 状态
    currentTheme: readonly(currentTheme),
    colorMode: readonly(colorMode),
    isDark: readonly(isDark),

    // 主题切换
    setTheme(theme: ThemeName) {
      currentTheme.value = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    },

    // 颜色模式切换
    setColorMode(mode: ColorMode) {
      colorMode.value = mode;
      localStorage.setItem(MODE_STORAGE_KEY, mode);

      if (mode === "light") {
        isDark.value = false;
      } else if (mode === "dark") {
        isDark.value = true;
      } else {
        updateSystemDark();
      }
    },

    // 切换暗色模式
    toggleDark() {
      const newMode = isDark.value ? "light" : "dark";
      this.setColorMode(newMode);
    },

    // 加载持久化设置
    loadPersistedSettings() {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName;
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as ColorMode;

      if (savedTheme && savedTheme in BUILT_IN_THEMES) {
        currentTheme.value = savedTheme;
      }

      if (savedMode) {
        this.setColorMode(savedMode);
      } else {
        initSystemMode();
      }
    },

    // 获取主题列表
    getThemes() {
      return Object.entries(BUILT_IN_THEMES).map(([key, value]) => ({
        key: key as ThemeName,
        ...value,
      }));
    },
  };
}

// 自动初始化
if (typeof window !== "undefined") {
  initSystemMode();
}
