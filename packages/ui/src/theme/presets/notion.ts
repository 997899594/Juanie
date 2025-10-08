import type { ThemePreset } from '../types'

export const notionTheme: ThemePreset = {
  id: 'notion',
  name: 'Notion',
  description: 'Notion 官方极简主题，专注内容',
  source: 'builtin',
  variants: {
    light: {
      id: 'notion-light',
      name: 'Notion 浅色',
      colors: {
        // 📝 基于 Notion 官方设计系统
        background: '0.99 0.005 60', // 微暖白背景 #FEFEFE
        foreground: '0.22 0.03 260', // Notion 经典深灰 #37352F
        card: '1 0 0', // 纯白卡片
        'card-foreground': '0.22 0.03 260',
        popover: '1 0 0',
        'popover-foreground': '0.22 0.03 260',
        primary: '0.22 0.03 260', // Notion 深灰主色
        'primary-foreground': '1 0 0',
        secondary: '0.96 0.01 60', // 暖灰背景
        'secondary-foreground': '0.22 0.03 260',
        muted: '0.96 0.01 60',
        'muted-foreground': '0.5 0.02 260', // 中等灰度
        accent: '0.94 0.02 60', // 暖灰悬停
        'accent-foreground': '0.22 0.03 260',
        destructive: '0.5 0.6 15', // 温和红色
        'destructive-foreground': '1 0 0',
        success: '0.45 0.4 140', // 温和绿色
        'success-foreground': '1 0 0',
        warning: '0.6 0.5 50', // 温和橙色
        'warning-foreground': '0.22 0.03 260',
        info: '0.5 0.4 220', // 温和蓝色
        'info-foreground': '1 0 0',
        border: '0.9 0.01 60', // 极浅暖灰边框
        input: '0.9 0.01 60',
        ring: '0.22 0.03 260',
      },
      tokens: {
        radius: '0.1875rem', // Notion 的极小圆角 3px
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
        'animation-duration-fast': '150ms', // 更快的动画
        'animation-duration-normal': '250ms',
        'animation-duration-slow': '400ms',
      },
      custom: {
        'font-family':
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif',
        'line-height': '1.65', // Notion 的舒适行高
        'letter-spacing': '-0.01em', // 微调字间距
      },
    },
    dark: {
      id: 'notion-dark',
      name: 'Notion 深色',
      colors: {
        // 🌙 Notion 暗色模式 #191919
        background: '0.1 0.01 260', // Notion 深色背景
        foreground: '0.9 0.01 60', // 暖白文字
        card: '0.14 0.01 260', // 深色卡片
        'card-foreground': '0.9 0.01 60',
        popover: '0.1 0.01 260',
        'popover-foreground': '0.9 0.01 60',
        primary: '0.9 0.01 60', // 暖白主色
        'primary-foreground': '0.1 0.01 260',
        secondary: '0.2 0.01 260', // 深灰次要
        'secondary-foreground': '0.9 0.01 60',
        muted: '0.2 0.01 260',
        'muted-foreground': '0.6 0.01 60', // 暖灰
        accent: '0.25 0.01 260', // 深灰强调
        'accent-foreground': '0.9 0.01 60',
        destructive: '0.4 0.5 15',
        'destructive-foreground': '0.9 0.01 60',
        success: '0.35 0.3 140',
        'success-foreground': '0.9 0.01 60',
        warning: '0.5 0.4 50',
        'warning-foreground': '0.1 0.01 260',
        info: '0.4 0.3 220',
        'info-foreground': '0.9 0.01 60',
        border: '0.25 0.01 260', // 深灰边框
        input: '0.25 0.01 260',
        ring: '0.6 0.01 60',
      },
      tokens: {
        radius: '0.1875rem',
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
        'animation-duration-fast': '150ms',
        'animation-duration-normal': '250ms',
        'animation-duration-slow': '400ms',
      },
      custom: {
        'font-family':
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif',
        'line-height': '1.65',
        'letter-spacing': '-0.01em',
      },
    },
  },
}
