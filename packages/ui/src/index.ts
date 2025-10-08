// 导入样式文件
import './styles/globals.css'

// 注册所有预设主题
import { registerAllPresets } from './theme/presets'

registerAllPresets()

// 导出工具函数
export { cn } from './lib/utils'

// 🎯 导出主题系统
export * from './theme'
export type { UseThemeReturn } from './theme/composables/useTheme'
// 🎯 确保 useTheme 被正确导出
export { useTheme } from './theme/composables/useTheme'
