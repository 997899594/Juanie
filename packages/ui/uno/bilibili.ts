/**
 * UnoCSS Bilibili 主题配置
 * 从设计令牌自动生成，确保与 Naive UI 主题同步
 */

import { bilibiliTokens } from '../src/tokens/bilibili'
import { createUnoShortcuts, createUnoTheme } from './utils'

/**
 * Bilibili UnoCSS 主题配置
 * 从 bilibiliTokens 自动生成
 */
export const bilibiliUnoTheme = createUnoTheme(bilibiliTokens)

/**
 * Bilibili UnoCSS 快捷类配置
 * 从 bilibiliTokens 自动生成
 */
export const bilibiliUnoShortcuts = createUnoShortcuts(bilibiliTokens)

/**
 * 完整的 Bilibili UnoCSS 配置
 */
export const bilibiliUnoConfig = {
  theme: bilibiliUnoTheme,
  shortcuts: bilibiliUnoShortcuts,
}
