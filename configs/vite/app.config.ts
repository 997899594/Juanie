import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

export interface AppOptions {
  port?: number
  host?: boolean
  alias?: Record<string, string>
  proxy?: Record<string, any>
  manualChunks?: Record<string, string[]>
  optimizeDepsInclude?: string[]
}

export default function createAppConfig(options: AppOptions = {}) {
  const {
    port = 5173,
    host = true,
    alias = {
      '@': resolve(process.cwd(), 'src'),
    },
    proxy = {},
    manualChunks = {
      'vue-vendor': ['vue', 'vue-router', 'pinia'],
      utils: ['lodash-es', 'dayjs', '@vueuse/core'],
    },
    optimizeDepsInclude = ['vue', 'vue-router', 'pinia', '@vueuse/core', 'lodash-es', 'dayjs'],
  } = options

  return defineConfig({
    plugins: [
      vue(),
      tailwindcss(),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: true,
        dirs: ['src/composables', 'src/stores', 'src/utils'],
      }),
      Components({
        dts: true,
        dirs: ['src/components', 'src/layouts'],
      }),
    ],
    resolve: {
      // 🎯 2025 最佳实践：条件导入支持开发时源码
      conditions: ['development', 'import', 'module', 'browser', 'default'],
      alias,
    },

    // 🎯 优化依赖处理：排除 workspace 包
    optimizeDeps: {
      exclude: ['@juanie/ui', '@juanie/shared'],
      include: optimizeDepsInclude,
    },

    server: {
      port,
      host,
      proxy,
      // 🎯 允许访问 workspace 根目录
      fs: {
        allow: ['../..'],
      },
    },
    build: {
      target: 'esnext',
      // minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  })
}
