// 建议添加更细粒度的导出控制
// 样式导入 - shadcn-vue 必需
import "./styles/globals.css";

// 组件导出 - 按需导出
export * from "./components/ui";
// 主题系统导出
export * from "./composables/useTheme";
export * from "./styles/themes";
// 类型导出
export type * from "./types";
// 工具函数导出
export { cn } from "./utils/cn";

// 版本信息
export const version = "1.0.0";

// 新增：预设配置导出
// export { default as defaultTheme } from "./styles/themes/default";
