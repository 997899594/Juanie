import { computed, onMounted, readonly, ref } from "vue";
import {
  BUILTIN_THEMES,
  getCSSVariable,
  getCurrentTheme,
  getThemeGroups,
  getThemesByGroup,
  isDarkTheme,
  restoreTheme,
  setTheme as setThemeUtil,
  type THEME_GROUPS,
  type ThemeConfig,
  toggleThemeMode,
} from "../styles/themes";

export function useTheme() {
  // 响应式状态
  const currentTheme = ref<string>("default");
  const customThemes = ref<ThemeConfig[]>([]);

  // 计算属性
  const availableThemes = computed(() => {
    return [...BUILTIN_THEMES, ...customThemes.value];
  });

  const themeGroups = computed(() => {
    return getThemeGroups();
  });

  const currentThemeConfig = computed(() => {
    const theme = availableThemes.value.find(t => t.name === currentTheme.value);
    return theme || null;
  });

  const isDark = computed(() => {
    return currentTheme.value.includes("dark");
  });

  // 方法
  const setTheme = (themeName: string) => {
    if (setThemeUtil(themeName)) {
      currentTheme.value = themeName;
      return true;
    }
    return false;
  };

  const toggleMode = () => {
    const newTheme = toggleThemeMode();
    currentTheme.value = newTheme;
    return newTheme;
  };

  const addCustomTheme = (theme: ThemeConfig) => {
    const exists = customThemes.value.find(
      (t: ThemeConfig) => t.name === theme.name
    );
    if (!exists) {
      customThemes.value.push(theme);
    }
  };

  const removeCustomTheme = (themeName: string) => {
    const index = customThemes.value.findIndex(
      (t: ThemeConfig) => t.name === themeName
    );
    if (index > -1) {
      customThemes.value.splice(index, 1);
    }
  };

  const getVariable = (variable: string) => {
    return getCSSVariable(variable);
  };

  const getThemesByGroupName = (groupName: string) => {
    return getThemesByGroup(groupName as keyof typeof THEME_GROUPS);
  };

  // 初始化
  onMounted(() => {
    currentTheme.value = restoreTheme();
  });

  return {
    // 状态
    currentTheme: readonly(currentTheme),
    customThemes: readonly(customThemes),

    // 计算属性
    availableThemes,
    themeGroups,
    currentThemeConfig,
    isDark,

    // 方法
    setTheme,
    toggleMode,
    addCustomTheme,
    removeCustomTheme,
    getVariable,
    getThemesByGroup: getThemesByGroupName,
  };
}

// 导出类型
// export type { ThemeConfig };
