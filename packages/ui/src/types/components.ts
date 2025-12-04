import type { HTMLAttributes } from 'vue'

// 建议添加更多通用类型
export interface BaseComponentProps extends HTMLAttributes {
  class?: string
  'data-testid'?: string // 测试支持
}

export type ComponentSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl' | '2xl' // 扩展尺寸
export type ComponentVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'gradient'
  | 'glass'

// 新增：响应式尺寸类型
export type ResponsiveSize =
  | ComponentSize
  | {
      sm?: ComponentSize
      md?: ComponentSize
      lg?: ComponentSize
      xl?: ComponentSize
    }
