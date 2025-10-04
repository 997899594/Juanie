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
    'ui-vendor': ['naive-ui'],
    'utils-vendor': ['@vueuse/core', 'lodash-es', 'dayjs'],
    'charts-vendor': ['echarts'],
  },
  optimizeDepsInclude: [
    'vue',
    'vue-router',
    'pinia',
    'naive-ui',
    '@vueuse/core',
    'echarts',
    'lodash-es',
    'dayjs',
  ],
})
