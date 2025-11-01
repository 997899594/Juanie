import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
      copyDtsFiles: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      name: 'JuanieUI',
      entry: 'src/index.ts',
      fileName: (format) => `index.${format}.js`,
      formats: ['es'], // 只输出 ES 模块以支持 Tree-shaking
    },
    rollupOptions: {
      // 不打包这些依赖，使用宿主应用的实例
      external: [
        'vue',
        '@vueuse/core',
        'radix-vue',
        'reka-ui',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      output: {
        // 保留模块结构以支持 Tree-shaking
        preserveModules: true,
        preserveModulesRoot: 'src',
        // 为外部依赖提供全局变量名
        globals: {
          vue: 'Vue',
        },
        // 优化输出
        exports: 'named',
        // 分离样式文件
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'ui.css'
          return assetInfo.name || ''
        },
      },
    },
    // 优化构建
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 移除 console
        drop_debugger: true, // 移除 debugger
        pure_funcs: ['console.log'], // 移除特定函数调用
      },
    },
    // CSS 代码分割
    cssCodeSplit: true,
    // 生成 sourcemap
    sourcemap: true,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
    exclude: ['@juanie/ui'],
  },
})
