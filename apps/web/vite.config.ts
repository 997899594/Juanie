import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, type PluginOption } from 'vite'

export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    tailwindcss() as unknown as PluginOption,
    // 自动导入 Vue、VueUse、Pinia、Vue Router API
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: 'auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true,
    }),
    // 自动导入 UI 组件
    Components({
      dts: 'components.d.ts',
      dirs: ['src/components'],
      resolvers: [
        // 自动导入 @juanie/ui 组件
        (componentName) => {
          if (componentName.startsWith('Ui')) {
            return {
              name: componentName.slice(2), // 移除 Ui 前缀
              from: '@juanie/ui',
            }
          }
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      tslib: 'tslib/tslib.es6.js',
    },
    // 确保 UI 库与应用使用同一份 Vue 实例，避免运行时冲突
    dedupe: ['vue', 'vue-router', '@vueuse/core', '@vueuse/motion'],
    conditions: process.env.NODE_ENV === 'development' ? ['development'] : ['default'],
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'lucide-vue-next',
      '@vueuse/core',
      '@vueuse/motion',
      'date-fns',
      'zod',
      'tslib',
    ],
    exclude: ['@juanie/types', '@juanie/api-new'],
    // Vite 6 兼容性修复：确保 tslib 被正确处理
    esbuildOptions: {
      target: 'esnext',
    },
  },
  // Vite 6 兼容性修复：为 @vueuse/motion 添加特殊处理
  define: {
    // 确保 tslib 的 __extends 等函数可用
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  server: {
    port: 1997,
    host: true,
    // 通过代理把 /trpc 请求转发到后端，避免 CORS
    proxy: {
      '/trpc': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3002',
        changeOrigin: true,
        // tRPC endpoint 不需要重写路径，保持原样
      },
    },
    // 严格的文件监听配置，防止卡死
    watch: {
      // 忽略这些目录，减少文件监听负担
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.turbo/**',
        '**/coverage/**',
        // 但不忽略 UI 包的 dist（如果需要监听）
        '!**/node_modules/@juanie/ui/dist/**',
      ],
      // 使用轮询作为后备方案（macOS 上更可靠）
      usePolling: false, // 先尝试不用轮询
      // 如果卡死，可以改为 true 并设置间隔
      // usePolling: true,
      // interval: 1000,
    },
    // 预热常用文件，加快首次加载
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue', './src/router/index.ts'],
    },
    // HMR 配置
    hmr: {
      overlay: true,
      // 如果 HMR 有问题，可以尝试使用 WebSocket
      // protocol: 'ws',
      // host: 'localhost',
    },
  },
  build: {
    target: 'esnext',
    // 禁用压缩大小报告，加快构建
    reportCompressedSize: false,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 生成 sourcemap
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        // 手动分包策略，优化加载性能
        manualChunks: (id) => {
          // Vue 核心库
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router/')) {
            return 'vue-core'
          }
          // UI 组件库（支持 tree-shaking）
          if (id.includes('@juanie/ui')) {
            // 按组件分包，实现按需加载
            if (id.includes('/components/ui/button')) return 'ui-button'
            if (id.includes('/components/ui/dialog')) return 'ui-dialog'
            if (id.includes('/components/ui/form')) return 'ui-form'
            if (id.includes('/components/ui/table')) return 'ui-table'
            if (id.includes('/theme')) return 'ui-theme'
            // 其他 UI 组件
            return 'ui-components'
          }
          // 图标库
          if (id.includes('lucide-vue-next')) {
            return 'icons'
          }
          // 工具库
          if (id.includes('node_modules/@vueuse/')) {
            return 'vueuse'
          }
          // 其他第三方库
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
          return undefined
        },
        // 优化 chunk 文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },
  // 日志级别
  logLevel: 'info',
  // 清除屏幕
  clearScreen: false,
})
