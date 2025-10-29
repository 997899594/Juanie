import { resolve } from 'node:path'
import type { UserConfig } from 'vite'

/**
 * Vite 配置 - Vue 应用
 * 用于构建 Vue 3 应用（如 apps/web）
 */
export function defineAppConfig(options: {
  /** 项目根目录 */
  root: string
  /** 开发服务器端口 */
  port?: number
  /** 是否启用 Tailwind CSS */
  tailwind?: boolean
  /** 额外的 Vite 插件 */
  plugins?: any[]
}): UserConfig {
  const { root, port = 3000, tailwind = false, plugins = [] } = options

  const vitePlugins: any[] = [...plugins]

  // 动态导入 Vue 插件
  const vuePlugin = async () => {
    const vue = await import('@vitejs/plugin-vue')
    return vue.default()
  }

  // 动态导入 Tailwind 插件
  const tailwindPlugin = async () => {
    if (tailwind) {
      const tailwindcss = await import('@tailwindcss/vite')
      return tailwindcss.default()
    }
    return null
  }

  return {
    plugins: [vuePlugin(), tailwindPlugin(), ...vitePlugins].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(root, 'src'),
      },
      dedupe: ['vue'],
    },
    optimizeDeps: {
      include: ['vue', 'vue-router'],
      exclude: ['@juanie/ui'],
    },
    server: {
      port,
      host: true,
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router'],
          },
        },
      },
    },
  }
}
