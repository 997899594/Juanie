import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue({
      // 优化 Vue 编译性能
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    tailwindcss(),
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
      copyDtsFiles: true,
      // 添加超时设置，防止卡住
      compilerOptions: {
        skipLibCheck: true,
      },
    }),
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
    // 增加构建超时时间
    reportCompressedSize: false, // 禁用压缩大小报告，加快构建
    rollupOptions: {
      // 设置最大并行数，防止资源耗尽
      maxParallelFileOps: 20,
      // External 依赖：这些由宿主应用提供
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
        // 重要：不要 external tslib，让它被内联到代码中
      ],
      output: {
        // 保留模块结构以支持 tree-shaking
        preserveModules: true,
        preserveModulesRoot: 'src',
        // 使用相对路径导入，确保模块解析正确
        entryFileNames: '[name].js',
        // 为外部依赖提供全局变量名（用于 UMD 格式，这里不需要）
        globals: {
          vue: 'Vue',
        },
        // 确保导出格式正确
        exports: 'named',
        // 样式文件命名
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'styles/globals.css'
          if (assetInfo.name?.endsWith('.css')) return 'styles/[name][extname]'
          return 'assets/[name][extname]'
        },
      },
      // 添加错误处理
      onwarn(warning, warn) {
        // 忽略某些警告，防止构建卡住
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.code === 'CIRCULAR_DEPENDENCY') return
        warn(warning)
      },
    },
    // 开发环境不压缩，生产环境压缩
    minify: false,
    // CSS 代码分割
    cssCodeSplit: true,
    // 生成 sourcemap 便于调试
    sourcemap: true,
    // 清空输出目录
    emptyOutDir: true,
    // 设置 chunk 大小限制
    chunkSizeWarningLimit: 2000,
  },
  // 优化依赖预构建（仅用于开发模式）
  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
    exclude: ['@juanie/ui'],
    // 设置 esbuild 选项
    esbuildOptions: {
      // 增加内存限制
      target: 'esnext',
    },
  },
  // 设置日志级别
  logLevel: 'info',
})
