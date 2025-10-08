import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import createAppConfig from '../../configs/vite/app.config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default createAppConfig({
  alias: {
    '@': resolve(__dirname, 'src'),
  },
  proxy: {
    '/api': {
      target: process.env.VITE_API_URL ?? 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
  },
  manualChunks: {
    'vue-vendor': ['vue', 'vue-router', 'pinia'],
    'ui-vendor': ['@juanie/ui'],
    'utils-vendor': ['@vueuse/core', 'lodash-es', 'dayjs'],
    'charts-vendor': ['echarts'],
  },
  // 🎯 移除 @juanie/ui，让它使用源码
  optimizeDepsInclude: [
    'vue',
    'vue-router',
    'pinia',
    '@vueuse/core',
    'echarts',
    'lodash-es',
    'dayjs',
  ],
})
