export * from './bilibili'
export * from './default'
export * from './notion'

import { registerTheme } from '../utils/theme-loader'
import { bilibiliTheme } from './bilibili'
import { defaultTheme } from './default'
import { notionTheme } from './notion'

// 🎯 自动注册所有预设主题
export function registerAllPresets() {
  console.log('Registering all presets...')
  registerTheme(defaultTheme)
  registerTheme(bilibiliTheme)
  registerTheme(notionTheme)
  console.log('All presets registered')
}

// 🎯 立即执行注册
registerAllPresets()

// todo可能废弃
