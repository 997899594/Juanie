import type { UserConfig } from 'vite'

/**
 * Vite 配置 - 纯 TypeScript 库
 * 用于构建纯 TS 库（如 packages/shared）
 */
export function defineLibConfig(options: {
  /** 库名称 */
  name: string
  /** 入口文件路径 */
  entry: string
  /** 外部依赖 */
  external?: string[]
}): UserConfig {
  const { name, entry, external = [] } = options

  return {
    build: {
      lib: {
        name,
        entry,
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external,
      },
    },
  }
}
