import { resolve } from 'node:path'
import type { UserConfig } from 'vite'

/**
 * Vite 配置 - Vue 组件库
 * 用于构建 Vue 组件库（如 packages/ui）
 */
export function defineVueLibConfig(options: {
  /** 库名称 */
  name: string
  /** 入口文件路径 */
  entry: string
  /** 项目根目录 */
  root: string
  /** 是否生成类型声明 */
  dts?: boolean
  /** 是否启用 Tailwind CSS */
  tailwind?: boolean
}): UserConfig {
  const { name, entry, root, dts = true, tailwind = false } = options

  const plugins: any[] = []

  // 动态导入 Vue 插件
  const vuePlugin = async () => {
    const vue = await import('@vitejs/plugin-vue')
    return vue.default()
  }
  plugins.push(vuePlugin())

  // 动态导入 Tailwind 插件
  if (tailwind) {
    const tailwindPlugin = async () => {
      const tailwindcss = await import('@tailwindcss/vite')
      return tailwindcss.default()
    }
    plugins.push(tailwindPlugin())
  }

  // 动态导入 DTS 插件
  if (dts) {
    const dtsPlugin = async () => {
      const dtsModule = await import('vite-plugin-dts')
      return dtsModule.default({
        rollupTypes: true,
        insertTypesEntry: true,
      })
    }
    plugins.push(dtsPlugin())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': resolve(root, './src'),
      },
    },
    build: {
      lib: {
        name,
        entry,
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          globals: {
            vue: 'Vue',
          },
        },
      },
    },
  }
}
