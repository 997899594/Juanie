/**
 * UnoCSS 配置入口
 * 导出 Bilibili 主题的 UnoCSS 配置
 */

import { defineConfig, presetAttributify, presetIcons, presetUno } from 'unocss'
import { bilibiliUnoShortcuts, bilibiliUnoTheme } from './bilibili'

/**
 * 默认的 UnoCSS 配置
 * 基于 Bilibili 设计令牌
 */
export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  theme: bilibiliUnoTheme,
  shortcuts: bilibiliUnoShortcuts,
  content: {
    pipeline: {
      include: [
        // 默认包含的文件类型
        /\.(vue|svelte|[jt]sx?|mdx?|astro|elm|php|phtml|html)($|\?)/,
        // 包含 src 目录
        'src/**/*.{js,ts,jsx,tsx,vue}',
      ],
    },
  },
})

// 导出主题和快捷类供外部使用
export { bilibiliUnoTheme, bilibiliUnoShortcuts }
