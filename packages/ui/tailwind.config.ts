import type { Config } from 'tailwindcss'
import { juanieTailwindPreset } from './theme.config'

export default {
  content: [
    './src/**/*.{vue,js,ts,jsx,tsx}',
    // 包含虚拟类文件
    './src/styles/tailwind-classes.ts',
  ],
  ...juanieTailwindPreset,
} satisfies Config
