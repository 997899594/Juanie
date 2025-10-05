/**
 * Bilibili 设计令牌 - 单一真理源
 *
 * 这个文件是所有 Bilibili 主题配置的权威来源
 * 包括：CSS变量、Naive UI主题、UnoCSS配置
 */

import type {
  AnimationTokens,
  ColorTokens,
  DesignTokens,
  NeutralColorTokens,
  RadiusTokens,
  SemanticColorTokens,
  ShadowTokens,
  SpacingTokens,
  TypographyTokens,
} from './types'

// ===== 基础色彩令牌 =====
export const bilibiliColors = {
  // B站品牌色
  pink: {
    50: '#fef7f9',
    100: '#fdeef2',
    200: '#fbd7e3',
    300: '#f7b2c8',
    400: '#fb7299', // B站主品牌色
    500: '#e85a8a',
    600: '#d4477a',
    700: '#b8396a',
    800: '#9c2f5a',
    900: '#7d2549',
  },

  // B站蓝色
  blue: {
    50: '#e6f7ff',
    100: '#bae7ff',
    200: '#91d5ff',
    300: '#69c0ff',
    400: '#40a9ff',
    500: '#00a1d6', // B站蓝
    600: '#0090c1',
    700: '#006d9c',
    800: '#004a77',
    900: '#002952',
  },

  // 中性色系
  gray: {
    50: '#fafbfc', // 极浅灰背景
    100: '#f4f5f7', // 浅灰次背景
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // 功能色
  success: '#00c091',
  warning: '#ff9500',
  error: '#ff6875',
  info: '#00a1d6',
} as const

// ===== 颜色令牌（符合ColorTokens接口）=====
export const bilibiliColorTokens: ColorTokens = {
  primary: bilibiliColors.pink[400],
  primaryHover: bilibiliColors.pink[500],
  primaryPressed: bilibiliColors.pink[600],
  secondary: bilibiliColors.blue[500],
  secondaryHover: bilibiliColors.blue[600],
  secondaryPressed: bilibiliColors.blue[700],
}

// ===== 语义化令牌（符合SemanticColorTokens接口）=====
export const bilibiliSemanticTokens: SemanticColorTokens = {
  // 功能色
  success: bilibiliColors.success,
  successHover: '#52c41a',
  successPressed: '#389e0d',

  warning: bilibiliColors.warning,
  warningHover: '#ffa940',
  warningPressed: '#d48806',

  error: bilibiliColors.error,
  errorHover: '#ff7875',
  errorPressed: '#d9363e',

  info: bilibiliColors.info,
  infoHover: '#40a9ff',
  infoPressed: '#096dd9',
}

// ===== 中性色令牌（符合NeutralColorTokens接口）=====
export const bilibiliNeutralTokens: NeutralColorTokens = {
  // 背景色
  bgPrimary: '#ffffff',
  bgSecondary: bilibiliColors.gray[50],
  bgTertiary: bilibiliColors.gray[100],
  bgHover: '#f8f9fa',
  bgPressed: '#e9ecef',

  // 文本色
  textPrimary: bilibiliColors.gray[900],
  textSecondary: bilibiliColors.gray[600],
  textTertiary: bilibiliColors.gray[400],
  textDisabled: bilibiliColors.gray[300],

  // 边框色
  borderLightest: bilibiliColors.gray[200],
  borderLight: bilibiliColors.gray[300],
  borderHover: bilibiliColors.pink[400],
  borderFocus: bilibiliColors.pink[400],
}

// ===== 尺寸令牌（符合SpacingTokens接口）=====
export const bilibiliSpacing: SpacingTokens = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
}

// ===== 圆角令牌（符合RadiusTokens接口）=====
export const bilibiliRadius: RadiusTokens = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
}

// ===== 字体令牌（符合TypographyTokens接口）=====
export const bilibiliTypography: TypographyTokens = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '14px', // B站默认字体大小
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '32px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.6',
  },
}

// ===== 阴影令牌（符合ShadowTokens接口）=====
export const bilibiliShadows: ShadowTokens = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
}

// ===== 动画令牌（符合AnimationTokens接口）=====
export const bilibiliAnimations: AnimationTokens = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
}

// ===== 完整的设计令牌导出（符合DesignTokens接口）=====
export const bilibiliTokens: DesignTokens = {
  colors: bilibiliColorTokens,
  semantic: bilibiliSemanticTokens,
  neutral: bilibiliNeutralTokens,
  spacing: bilibiliSpacing,
  radius: bilibiliRadius,
  typography: bilibiliTypography,
  shadows: bilibiliShadows,
  animations: bilibiliAnimations,
}

// ===== 类型导出 =====
export type BilibiliTokens = typeof bilibiliTokens
export type BilibiliColors = typeof bilibiliColors
export type BilibiliColorTokens = typeof bilibiliColorTokens
export type BilibiliSemanticTokens = typeof bilibiliSemanticTokens
export type BilibiliNeutralTokens = typeof bilibiliNeutralTokens

// ===== 默认导出 =====
export default bilibiliTokens
