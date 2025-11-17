// 样式导入 - shadcn-vue 必需
import './styles/globals.css'
import 'vue-sonner/style.css'

// Toast 导出
export { toast } from 'vue-sonner'
// 组件导出 - 按需导出
export * from './components/ui'
// 主题系统导出
export * from './theme'
// 类型导出
export type * from './types'

// 新增：预设配置导出
// export { default as defaultTheme } from "./styles/themes/default";
