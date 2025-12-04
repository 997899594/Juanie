import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * 快速构建配置
 * - 跳过类型生成
 * - 禁用 sourcemap
 * - 最小化输出
 */
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    tailwindcss(),
    // 不生成 .d.ts 文件，加快构建速度
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    reportCompressedSize: false,
    rollupOptions: {
      maxParallelFileOps: 30, // 增加并行文件操作数
      external: [
        'vue',
        'vue-router',
        '@vueuse/core',
        '@vueuse/motion',
        'radix-vue',
        'reka-ui',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'lucide-vue-next',
        'vue-sonner',
        '@tanstack/vue-table',
        '@unovis/ts',
        '@unovis/vue',
        'embla-carousel-vue',
        'vaul-vue',
        'vee-validate',
        '@vee-validate/zod',
      ],
      output: {
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
        globals: {
          vue: 'Vue',
        },
        exports: 'named',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'globals.css'
          if (assetInfo.name?.endsWith('.css')) return '[name][extname]'
          return 'assets/[name][extname]'
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.code === 'CIRCULAR_DEPENDENCY') return
        warn(warning)
      },
    },
    minify: false, // 跳过压缩
    cssCodeSplit: false,
    sourcemap: false, // 跳过 sourcemap
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
    exclude: ['@juanie/ui'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  logLevel: 'warn', // 减少日志输出
})
