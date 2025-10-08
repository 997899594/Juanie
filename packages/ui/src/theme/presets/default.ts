import type { ThemePreset } from '../types'

export const defaultTheme: ThemePreset = {
  id: 'default',
  name: 'Slate',
  description: 'shadcn-vue 官方 Slate 主题，专业优雅',
  source: 'builtin',
  variants: {
    light: {
      id: 'slate-light',
      name: 'Slate 浅色',
      colors: {
        // 🎨 基于 shadcn-vue 官方 Slate 配色
        background: '1 0 0', // hsl(0 0% 100%) - 纯白
        foreground: '0.112 0.047 264.7', // hsl(222.2 47.4% 11.2%) - 深蓝灰
        card: '1 0 0', // 卡片背景
        'card-foreground': '0.112 0.047 264.7',
        popover: '1 0 0',
        'popover-foreground': '0.112 0.047 264.7',
        primary: '0.112 0.047 264.7', // 主色：深蓝灰
        'primary-foreground': '0.98 0.004 247.9', // hsl(210 40% 98%) - 浅蓝白
        secondary: '0.961 0.004 247.9', // hsl(210 40% 96.1%) - 浅灰蓝
        'secondary-foreground': '0.112 0.047 264.7',
        muted: '0.961 0.004 247.9',
        'muted-foreground': '0.469 0.016 255.5', // hsl(215.4 16.3% 46.9%) - 中灰
        accent: '0.961 0.004 247.9',
        'accent-foreground': '0.112 0.047 264.7',
        destructive: '0.628 0.8 27.3', // hsl(0 84.2% 60.2%) - 红色
        'destructive-foreground': '0.98 0.004 247.9',
        success: '0.55 0.6 142', // hsl(142.1 76.2% 36.3%) - 绿色
        'success-foreground': '0.98 0.004 247.9',
        warning: '0.65 0.8 45', // hsl(45.4 93.4% 47.5%) - 黄色
        'warning-foreground': '0.112 0.047 264.7',
        info: '0.55 0.7 221', // hsl(221.2 83.2% 53.3%) - 蓝色
        'info-foreground': '0.98 0.004 247.9',
        border: '0.914 0.032 255.5', // hsl(214.3 31.8% 91.4%) - 浅边框
        input: '0.914 0.032 255.5',
        ring: '0.651 0.02 255.1', // hsl(215 20.2% 65.1%) - 焦点环
      },
      tokens: {
        radius: '0.5rem',
        'spacing-xs': '0.25rem',
        'spacing-sm': '0.5rem',
        'spacing-md': '1rem',
        'spacing-lg': '1.5rem',
        'spacing-xl': '2rem',
        'font-size-xs': '0.75rem',
        'font-size-sm': '0.875rem',
        'font-size-base': '1rem',
        'font-size-lg': '1.125rem',
        'font-size-xl': '1.25rem',
        'animation-duration-fast': '200ms',
        'animation-duration-normal': '300ms',
        'animation-duration-slow': '500ms',
      },
    },
    dark: {
      id: 'slate-dark',
      name: 'Slate 深色',
      colors: {
        // 🌙 shadcn-vue 官方暗色配色
        background: '0.145 0 0', // hsl(0 0% 3.9%) - 深黑
        foreground: '0.985 0 0', // hsl(0 0% 98%) - 浅白
        card: '0.205 0 0', // hsl(0 0% 3.9%) - 卡片背景
        'card-foreground': '0.985 0 0',
        popover: '0.269 0 0', // hsl(0 0% 3.9%) - 弹窗背景
        'popover-foreground': '0.985 0 0',
        primary: '0.922 0 0', // hsl(0 0% 98%) - 主色浅白
        'primary-foreground': '0.205 0 0', // 主色前景深色
        secondary: '0.269 0 0', // hsl(0 0% 14.9%) - 次要背景
        'secondary-foreground': '0.985 0 0',
        muted: '0.269 0 0',
        'muted-foreground': '0.708 0 0', // hsl(0 0% 63.9%) - 静音前景
        accent: '0.371 0 0', // hsl(0 0% 14.9%) - 强调背景
        'accent-foreground': '0.985 0 0',
        destructive: '0.704 0.191 22.2', // hsl(0 62.8% 30.6%) - 暗红
        'destructive-foreground': '0.985 0 0',
        success: '0.4 0.5 142', // 暗绿
        'success-foreground': '0.985 0 0',
        warning: '0.55 0.7 45', // 暗黄
        'warning-foreground': '0.145 0 0',
        info: '0.45 0.6 221', // 暗蓝
        'info-foreground': '0.985 0 0',
        border: '0.371 0 0', // hsl(0 0% 14.9%) - 边框
        input: '0.371 0 0',
        ring: '0.556 0 0', // hsl(0 0% 83.1%) - 焦点环
      },
      tokens: {
        radius: '0.5rem',
        'spacing-xs': '0.25rem',
        'spacing-sm': '0.5rem',
        'spacing-md': '1rem',
        'spacing-lg': '1.5rem',
        'spacing-xl': '2rem',
        'font-size-xs': '0.75rem',
        'font-size-sm': '0.875rem',
        'font-size-base': '1rem',
        'font-size-lg': '1.125rem',
        'font-size-xl': '1.25rem',
        'animation-duration-fast': '200ms',
        'animation-duration-normal': '300ms',
        'animation-duration-slow': '500ms',
      },
    },
  },
}
