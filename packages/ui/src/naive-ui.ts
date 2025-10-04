import type { GlobalThemeOverrides } from 'naive-ui'
import { type ConfigProviderProps, createDiscreteApi } from 'naive-ui'
import { themeConfig } from './theme'

// 导出主题覆盖类型
export type { ThemeOverrides } from './theme'
// 导出主题配置
export { darkThemeConfig, themeConfig, useTheme } from './theme'

// 基础 Naive UI 配置
export const naiveConfig = {
  // 基础配置
  theme: null as GlobalThemeOverrides | null,
  themeOverrides: themeConfig as GlobalThemeOverrides,
}

// 导出 Naive UI 相关类型
export type {
  DataTableBaseColumn,
  DataTableColumns,
  DialogOptions,
  FormItemRule,
  FormRules,
  GlobalTheme,
  GlobalThemeOverrides,
  LoadingBarApi as LoadingBarOptions,
  MenuOption,
  MessageOptions,
  NotificationOptions,
  ThemeCommonVars,
} from 'naive-ui'

const configProviderProps: ConfigProviderProps = {
  themeOverrides: themeConfig as GlobalThemeOverrides,
}

export const { message, notification, dialog, loadingBar } = createDiscreteApi(
  ['message', 'notification', 'dialog', 'loadingBar'],
  {
    configProviderProps,
  },
)
