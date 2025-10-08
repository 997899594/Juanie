import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './index.html',
    '../../packages/ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  // 🎯 v4 中不需要复杂的主题配置，@theme 指令会自动生成工具类
} satisfies Config
