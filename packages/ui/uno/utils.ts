/**
 * UnoCSS 生成工具函数
 * 提供从设计令牌自动生成 UnoCSS 配置的工具
 */

import type { Theme } from '@unocss/preset-uno'
import type { DesignTokens } from '../src/tokens/types'

/**
 * 从设计令牌生成 UnoCSS 主题配置
 * 扁平令牌：直接映射到 Naive-UI CSS 变量
 */
export function createUnoTheme(tokens: DesignTokens): Theme {
  const { colors, semantic, neutral, spacing, radius, typography, shadows, animations } = tokens

  return {
    colors: {
      // 品牌色 - 直接映射到 Naive-UI CSS 变量
      primary: 'rgb(var(--n-color-primary))',
      secondary: 'rgb(var(--n-color-primary-suppl))',

      // 功能色 - 直接映射到 Naive-UI CSS 变量
      success: 'rgb(var(--n-color-success))',
      warning: 'rgb(var(--n-color-warning))',
      error: 'rgb(var(--n-color-error))',
      info: 'rgb(var(--n-color-info))',

      // 背景色 - 直接映射到 Naive-UI CSS 变量
      'bg-base': 'rgb(var(--n-color-body))',
      'bg-primary': 'rgb(var(--n-color-body))',
      'bg-secondary': 'rgb(var(--n-color-card))',
      'bg-tertiary': 'rgb(var(--n-color-action))',
      'bg-hover': 'rgb(var(--n-color-hover))',
      'bg-pressed': 'rgb(var(--n-color-pressed))',

      // 文字色 - 直接映射到 Naive-UI CSS 变量
      'text-primary': 'rgb(var(--n-text-color))',
      'text-secondary': 'rgb(var(--n-text-color-2))',
      'text-tertiary': 'rgb(var(--n-text-color-3))',
      'text-disabled': 'rgb(var(--n-text-color-disabled))',

      // 边框色 - 直接映射到 Naive-UI CSS 变量
      'border-base': 'rgb(var(--n-border-color))',
      'border-light': 'rgb(var(--n-border-color))',
      'border-focus': 'rgb(var(--n-color-primary))',

      // 保持向后兼容的 Bilibili 特色色彩
      bilibili: {
        pink: colors.primary,
        'pink-hover': colors.primaryHover,
        'pink-pressed': colors.primaryPressed,
        blue: colors.secondary,
        'blue-hover': colors.secondaryHover,
        'blue-pressed': colors.secondaryPressed,
        muted: neutral.textSecondary,
        'ultra-light': neutral.bgTertiary,
      },
    },

    spacing: {
      xs: spacing.xs.replace('px', ''),
      sm: spacing.sm.replace('px', ''),
      md: spacing.md.replace('px', ''),
      lg: spacing.lg.replace('px', ''),
      xl: spacing.xl.replace('px', ''),
      '2xl': spacing['2xl'].replace('px', ''),
      '3xl': spacing['3xl'].replace('px', ''),
    },

    borderRadius: {
      none: radius.none,
      sm: radius.sm,
      DEFAULT: radius.md,
      md: radius.md,
      lg: radius.lg,
      xl: radius.xl,
      full: radius.full,
    },

    fontFamily: {
      sans: typography.fontFamily.sans.split(',').map((f) => f.trim().replace(/['"]/g, '')),
      mono: typography.fontFamily.mono.split(',').map((f) => f.trim().replace(/['"]/g, '')),
    } as Record<string, string | string[]>,

    fontSize: {
      xs: [typography.fontSize.xs, typography.lineHeight.tight],
      sm: [typography.fontSize.sm, typography.lineHeight.normal],
      base: [typography.fontSize.base, typography.lineHeight.normal],
      lg: [typography.fontSize.lg, typography.lineHeight.normal],
      xl: [typography.fontSize.xl, typography.lineHeight.relaxed],
      '2xl': [typography.fontSize['2xl'], typography.lineHeight.relaxed],
      '3xl': [typography.fontSize['3xl'], typography.lineHeight.relaxed],
      '4xl': [typography.fontSize['4xl'], typography.lineHeight.relaxed],
    },

    fontWeight: {
      normal: typography.fontWeight.normal,
      medium: typography.fontWeight.medium,
      semibold: typography.fontWeight.semibold,
      bold: typography.fontWeight.bold,
    },

    lineHeight: {
      tight: typography.lineHeight.tight,
      normal: typography.lineHeight.normal,
      relaxed: typography.lineHeight.relaxed,
    },

    boxShadow: {
      sm: shadows.sm,
      DEFAULT: shadows.md,
      md: shadows.md,
      lg: shadows.lg,
      xl: shadows.xl,
    },

    transitionDuration: {
      fast: animations.duration.fast.replace('ms', ''),
      DEFAULT: animations.duration.normal.replace('ms', ''),
      normal: animations.duration.normal.replace('ms', ''),
      slow: animations.duration.slow.replace('ms', ''),
    },

    transitionTimingFunction: {
      linear: animations.easing.linear,
      'ease-in': animations.easing.easeIn,
      'ease-out': animations.easing.easeOut,
      'ease-in-out': animations.easing.easeInOut,
    },
  }
}

/**
 * 从设计令牌生成 UnoCSS 快捷类配置
 */
export function createUnoShortcuts(tokens: DesignTokens) {
  return {
    // 布局快捷类
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'flex-start': 'flex items-center justify-start',
    'flex-end': 'flex items-center justify-end',
    'flex-col-center': 'flex flex-col items-center justify-center',
    'flex-col-between': 'flex flex-col items-center justify-between',
    'absolute-center': 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
    'fixed-center': 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',

    // Bilibili 品牌快捷类
    'bilibili-gradient': 'bg-gradient-to-r from-primary to-secondary',
    'bilibili-gradient-hover': 'bg-gradient-to-r from-primary-hover to-secondary-hover',
    'bilibili-text-gradient':
      'bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent',
    'bilibili-shadow': 'shadow-lg shadow-primary/20',
    'bilibili-glow': 'shadow-xl shadow-primary/30',

    // 按钮快捷类
    'btn-base':
      'inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    'btn-primary':
      'btn-base bg-primary text-white hover:bg-primary-hover focus:ring-primary/50 active:bg-primary-pressed',
    'btn-secondary':
      'btn-base bg-secondary text-primary hover:bg-hover focus:ring-border-focus active:bg-pressed',
    'btn-success':
      'btn-base bg-success text-white hover:bg-success-hover focus:ring-success/50 active:bg-success-pressed',
    'btn-warning':
      'btn-base bg-warning text-white hover:bg-warning-hover focus:ring-warning/50 active:bg-warning-pressed',
    'btn-error':
      'btn-base bg-error text-white hover:bg-error-hover focus:ring-error/50 active:bg-error-pressed',
    'btn-ghost':
      'btn-base bg-transparent border border-light text-primary hover:bg-hover hover:border-hover',

    // 卡片快捷类
    'card-base': 'bg-secondary border border-lightest rounded-lg shadow-sm',
    'card-hover': 'card-base hover:shadow-md hover:border-light transition-all duration-200',
    'card-interactive': 'card-hover cursor-pointer hover:bg-hover active:bg-pressed',

    // 输入框快捷类
    'input-base':
      'w-full px-3 py-2 bg-secondary border border-light rounded-md text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-focus transition-all duration-200',
    'input-error': 'input-base border-error focus:ring-error/50 focus:border-error',

    // 文本快捷类
    'text-gradient': 'bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent',
    'text-muted': 'text-secondary',
    'text-subtle': 'text-tertiary',
    'text-disabled': 'text-disabled',

    // 状态快捷类
    'status-success':
      'text-success bg-success/10 border border-success/20 rounded px-2 py-1 text-sm',
    'status-warning':
      'text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1 text-sm',
    'status-error': 'text-error bg-error/10 border border-error/20 rounded px-2 py-1 text-sm',
    'status-info': 'text-info bg-info/10 border border-info/20 rounded px-2 py-1 text-sm',

    // 动画快捷类
    'animate-fade-in': 'animate-in fade-in duration-200',
    'animate-fade-out': 'animate-out fade-out duration-200',
    'animate-slide-in': 'animate-in slide-in-from-bottom-2 duration-300',
    'animate-slide-out': 'animate-out slide-out-to-bottom-2 duration-300',
    'animate-scale-in': 'animate-in zoom-in-95 duration-200',
    'animate-scale-out': 'animate-out zoom-out-95 duration-200',

    // 响应式快捷类
    'container-responsive': 'container mx-auto px-4 sm:px-6 lg:px-8',
    'grid-responsive': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
    'text-responsive': 'text-sm sm:text-base lg:text-lg',

    // 特殊效果快捷类
    'glass-effect': 'backdrop-blur-md bg-white/10 border border-white/20',
    neumorphism:
      'bg-secondary shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]',
    'hover-lift': 'transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg',
  }
}

/**
 * 创建响应式断点配置
 */
export function createBreakpoints() {
  return {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  }
}

/**
 * 创建动画关键帧配置
 */
export function createKeyframes() {
  return {
    'fade-in': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    'fade-out': {
      '0%': { opacity: '1' },
      '100%': { opacity: '0' },
    },
    'slide-in-from-top': {
      '0%': { transform: 'translateY(-100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    'slide-in-from-bottom': {
      '0%': { transform: 'translateY(100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    'slide-in-from-left': {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(0)' },
    },
    'slide-in-from-right': {
      '0%': { transform: 'translateX(100%)' },
      '100%': { transform: 'translateX(0)' },
    },
    'zoom-in': {
      '0%': { transform: 'scale(0.95)', opacity: '0' },
      '100%': { transform: 'scale(1)', opacity: '1' },
    },
    'zoom-out': {
      '0%': { transform: 'scale(1)', opacity: '1' },
      '100%': { transform: 'scale(0.95)', opacity: '0' },
    },
    'bounce-in': {
      '0%': { transform: 'scale(0.3)', opacity: '0' },
      '50%': { transform: 'scale(1.05)' },
      '70%': { transform: 'scale(0.9)' },
      '100%': { transform: 'scale(1)', opacity: '1' },
    },
    'pulse-glow': {
      '0%, 100%': { boxShadow: '0 0 5px rgba(var(--primary-rgb), 0.5)' },
      '50%': { boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.8)' },
    },
  }
}
