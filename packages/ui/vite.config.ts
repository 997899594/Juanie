import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), tailwindcss(), dts({ rollupTypes: true, insertTypesEntry: true })],
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
    },
    rollupOptions: {
      // 不打包 Vue 到组件库，使用宿主应用的 Vue 实例
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
})
