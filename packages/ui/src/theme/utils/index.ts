// 主题工具函数导出
export { mergeThemeConfig } from './config-merger'
// 🎯 确保所有工具函数都正确导出
export * from './css-generator'
export * from './dom-utils'
export * from './theme-loader'
// 🎯 重新导出关键函数
export {
  getRegisteredThemes,
  isBuiltinTheme,
  loadThemePreset,
  registerAllThemes,
  registerTheme,
} from './theme-loader'
export * from './theme-validator'

export {
  validateThemeConfig,
  validateThemePackage,
  validateThemePreset,
} from './theme-validator'
