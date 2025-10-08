import type { ThemePreset } from '../types'

export const bilibiliTheme: ThemePreset = {
  id: 'bilibili',
  name: 'Bilibili',
  description: '哔哩哔哩官方粉色主题，青春活力',
  source: 'builtin',
  variants: {
    light: {
      id: 'bilibili-light',
      name: 'Bilibili 浅色',
      colors: {
        // 🎀 基于 Bilibili 官方品牌色系
        background: '1 0 0', // 纯白背景
        foreground: '0.15 0.02 260', // 深灰文字 #262626
        card: '1 0 0', // 纯白卡片
        'card-foreground': '0.15 0.02 260',
        popover: '1 0 0',
        'popover-foreground': '0.15 0.02 260',
        primary: '0.68 0.4 340', // Bilibili 主粉色 #FB7299
        'primary-foreground': '1 0 0',
        secondary: '0.98 0.02 340', // 极浅粉背景
        'secondary-foreground': '0.15 0.02 260',
        muted: '0.97 0.01 260', // 浅灰
        'muted-foreground': '0.45 0.02 260',
        accent: '0.95 0.05 340', // 粉色悬停
        'accent-foreground': '0.15 0.02 260',
        destructive: '0.55 0.8 15', // 红色
        'destructive-foreground': '1 0 0',
        success: '0.5 0.6 140', // 绿色
        'success-foreground': '1 0 0',
        warning: '0.6 0.8 45', // 橙色
        'warning-foreground': '0.15 0.02 260',
        info: '0.55 0.7 200', // 蓝色
        'info-foreground': '1 0 0',
        border: '0.94 0.02 340', // 粉色边框
        input: '0.94 0.02 340',
        ring: '0.68 0.4 340', // 粉色焦点环
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
      id: 'bilibili-dark',
      name: 'Bilibili 深色',
      colors: {
        // 🌙 Bilibili 暗色模式
        background: '0.08 0.01 260', // 深色背景 #141414
        foreground: '0.95 0.01 260', // 浅色文字
        card: '0.12 0.01 260', // 深色卡片
        'card-foreground': '0.95 0.01 260',
        popover: '0.08 0.01 260',
        'popover-foreground': '0.95 0.01 260',
        primary: '0.72 0.45 340', // 亮粉主色
        'primary-foreground': '0.08 0.01 260',
        secondary: '0.18 0.02 260', // 深灰次要
        'secondary-foreground': '0.95 0.01 260',
        muted: '0.18 0.02 260',
        'muted-foreground': '0.7 0.02 260',
        accent: '0.25 0.05 340', // 深粉强调
        'accent-foreground': '0.95 0.01 260',
        destructive: '0.5 0.7 15',
        'destructive-foreground': '0.95 0.01 260',
        success: '0.45 0.5 140',
        'success-foreground': '0.95 0.01 260',
        warning: '0.55 0.7 45',
        'warning-foreground': '0.08 0.01 260',
        info: '0.5 0.6 200',
        'info-foreground': '0.95 0.01 260',
        border: '0.25 0.02 260',
        input: '0.25 0.02 260',
        ring: '0.72 0.45 340',
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
