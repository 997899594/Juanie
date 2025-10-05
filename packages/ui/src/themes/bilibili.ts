import type { GlobalThemeOverrides } from 'naive-ui'
import { bilibiliColors, bilibiliSemanticTokens, bilibiliTokens } from '../tokens/bilibili'

/**
 * Bilibili 主题配置
 * 基于设计令牌系统的 Naive UI 主题覆盖
 */
export const bilibiliTheme: GlobalThemeOverrides = {
  common: {
    // 主色调
    primaryColor: bilibiliColors.blue[500],
    primaryColorHover: bilibiliColors.blue[400],
    primaryColorPressed: bilibiliColors.blue[600],
    primaryColorSuppl: bilibiliColors.blue[500],

    // 信息色
    infoColor: bilibiliColors.blue[500],
    infoColorHover: bilibiliColors.blue[400],
    infoColorPressed: bilibiliColors.blue[600],
    infoColorSuppl: bilibiliColors.blue[500],

    // 成功色
    successColor: bilibiliSemanticTokens.success,
    successColorHover: bilibiliSemanticTokens.successHover,
    successColorPressed: bilibiliSemanticTokens.successPressed,
    successColorSuppl: bilibiliSemanticTokens.success,

    // 警告色
    warningColor: bilibiliSemanticTokens.warning,
    warningColorHover: bilibiliSemanticTokens.warningHover,
    warningColorPressed: bilibiliSemanticTokens.warningPressed,
    warningColorSuppl: bilibiliSemanticTokens.warning,

    // 错误色
    errorColor: bilibiliSemanticTokens.error,
    errorColorHover: bilibiliSemanticTokens.errorHover,
    errorColorPressed: bilibiliSemanticTokens.errorPressed,
    errorColorSuppl: bilibiliSemanticTokens.error,

    // 文本色
    textColorBase: bilibiliColors.gray[900],
    textColor1: bilibiliColors.gray[900],
    textColor2: bilibiliColors.gray[700],
    textColor3: bilibiliColors.gray[500],
    textColorDisabled: bilibiliColors.gray[400],

    // 背景色
    bodyColor: bilibiliColors.gray[50],
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',

    // 边框色
    borderColor: bilibiliColors.gray[200],
    dividerColor: bilibiliColors.gray[200],

    // 圆角
    borderRadius: bilibiliTokens.radius.md,
    borderRadiusSmall: bilibiliTokens.radius.sm,

    // 字体
    fontFamily: bilibiliTokens.typography.fontFamily.sans,
    fontSize: bilibiliTokens.typography.fontSize.base,
    fontSizeMini: bilibiliTokens.typography.fontSize.xs,
    fontSizeTiny: bilibiliTokens.typography.fontSize.sm,
    fontSizeSmall: bilibiliTokens.typography.fontSize.sm,
    fontSizeMedium: bilibiliTokens.typography.fontSize.base,
    fontSizeLarge: bilibiliTokens.typography.fontSize.lg,
    fontSizeHuge: bilibiliTokens.typography.fontSize.xl,

    // 行高
    lineHeight: bilibiliTokens.typography.lineHeight.normal,

    // 阴影
    boxShadow1: bilibiliTokens.shadows.sm,
    boxShadow2: bilibiliTokens.shadows.md,
    boxShadow3: bilibiliTokens.shadows.lg,
  },

  // 按钮组件特定配置
  Button: {
    borderRadiusMedium: bilibiliTokens.radius.md,
    borderRadiusSmall: bilibiliTokens.radius.sm,
    borderRadiusLarge: bilibiliTokens.radius.lg,
  },

  // 输入框组件特定配置
  Input: {
    borderRadius: bilibiliTokens.radius.md,
  },

  // 卡片组件特定配置
  Card: {
    borderRadius: bilibiliTokens.radius.lg,
  },
}

export default bilibiliTheme
