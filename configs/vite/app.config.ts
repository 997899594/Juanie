import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
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
      'naive-ui': ['naive-ui'],
      'vue-vendor': ['vue', 'vue-router', 'pinia'],
      utils: ['lodash-es', 'dayjs', '@vueuse/core'],
    },
    optimizeDepsInclude = [
      'vue',
      'vue-router',
      'pinia',
      'naive-ui',
      '@vueuse/core',
      'lodash-es',
      'dayjs',
    ],
  } = options

  return defineConfig({
    plugins: [
      vue(),
      UnoCSS(),
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'pinia',
          '@vueuse/core',
          {
            'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
          },
        ],
        dts: true,
        dirs: ['src/composables', 'src/stores', 'src/utils'],
      }),
      Components({
        resolvers: [NaiveUiResolver()],
        dts: true,
        dirs: ['src/components', 'src/layouts'],
      }),
    ],
    resolve: {
      alias,
    },
    server: {
      port,
      host,
      proxy,
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    optimizeDeps: {
      include: optimizeDepsInclude,
    },
  })
}
