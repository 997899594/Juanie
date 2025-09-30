import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * Naive UI 主题配置 - 精简版
 * 只配置组件特有的属性，复用 UnoCSS 的设计令牌
 */
export const naiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    // 主色调 - 使用 B站 粉色
    primaryColor: '#fb7299',
    primaryColorHover: '#f48fb1',
    primaryColorPressed: '#e91e63',
    primaryColorSuppl: '#0ea5e9',
    
    // 信息色
    infoColor: '#0ea5e9',
    infoColorHover: '#38bdf8',
    infoColorPressed: '#0284c7',
    
    // 功能色
    successColor: '#10b981',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    
    // 圆角 - 统一使用 8px 基础圆角
    borderRadius: '8px',
    borderRadiusSmall: '4px',
    
    // 字体
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '14px',
    fontSizeMini: '12px',
    fontSizeTiny: '12px',
    fontSizeSmall: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    fontSizeHuge: '18px',
    
    // 字重
    fontWeightStrong: '600',
    
    // 行高
    lineHeight: '1.6',
    
    // 阴影 - 使用灰色阴影
    boxShadow1: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    boxShadow2: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    boxShadow3: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    
    // 动画时长
    cubicBezierEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    cubicBezierEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',
    cubicBezierEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  
  Button: {
    // 圆角
    borderRadiusTiny: '4px',
    borderRadiusSmall: '6px',
    borderRadiusMedium: '8px',
    borderRadiusLarge: '10px',
    
    // 字体大小
    fontSizeTiny: '12px',
    fontSizeSmall: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    
    // 字重
    fontWeight: '500',
    
    // 高度
    heightTiny: '22px',
    heightSmall: '28px',
    heightMedium: '34px',
    heightLarge: '40px',
    
    // 内边距
    paddingTiny: '0 8px',
    paddingSmall: '0 12px',
    paddingMedium: '0 16px',
    paddingLarge: '0 20px',
  },
  
  Card: {
    borderRadius: '16px',
    paddingMedium: '24px',
    paddingLarge: '32px',
    paddingHuge: '40px',
  },
  
  Input: {
    borderRadius: '8px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    heightMedium: '40px',
    heightLarge: '48px',
    paddingMedium: '0 12px',
    paddingLarge: '0 16px',
  },
  
  Menu: {
    borderRadius: '12px',
    itemHeight: '42px',
    itemIconSize: '18px',
    itemTextColor: '#6b7280',
    itemTextColorActive: '#fb7299',
    itemTextColorHover: '#fb7299',
    itemColorActive: 'rgba(251, 114, 153, 0.1)',
    itemColorHover: 'rgba(251, 114, 153, 0.05)',
  },
  
  Table: {
    borderRadius: '12px',
    thPaddingMedium: '12px 16px',
    tdPaddingMedium: '12px 16px',
    thPaddingLarge: '16px 20px',
    tdPaddingLarge: '16px 20px',
  },
  
  Modal: {
    borderRadius: '16px',
    paddingMedium: '24px',
    paddingLarge: '32px',
  },
  
  Tabs: {
    tabFontSizeMedium: '14px',
    tabFontSizeLarge: '16px',
    tabFontWeight: '500',
    tabGapMediumLine: '32px',
    tabGapLargeLine: '36px',
    tabPaddingMediumLine: '12px 0',
    tabPaddingLargeLine: '16px 0',
    tabTextColorActive: '#fb7299',
    tabTextColorHover: '#fb7299',
    barColor: '#fb7299',
  },
  
  Form: {
    labelFontSizeTopMedium: '14px',
    labelFontSizeTopLarge: '16px',
    labelHeightMedium: '24px',
    labelHeightLarge: '28px',
    labelPaddingVertical: '0 0 8px 0',
    labelTextColor: '#374151',
    asteriskColor: '#ef4444',
  },
  
  Select: {
    menuBorderRadius: '8px',
    optionHeightMedium: '36px',
    optionHeightLarge: '42px',
    optionPaddingMedium: '0 12px',
    optionPaddingLarge: '0 16px',
  },
  
  DatePicker: {
    itemBorderRadius: '6px',
    panelBorderRadius: '12px',
  },
  
  Notification: {
    borderRadius: '12px',
    padding: '16px 20px',
    titleFontSize: '16px',
    contentFontSize: '14px',
  },
  
  Message: {
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
  },
  
  Popover: {
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
  },
  
  Tooltip: {
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
  },
}