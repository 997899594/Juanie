import { createLibConfig } from '../../configs/vite/lib.config'

export default createLibConfig({
  name: 'JuanieUI',
  external: ['vue', '@vueuse/core', 'clsx', 'tailwind-merge'],
  input: 'src/index.ts',
  // 🎯 启用组件预览
  playground: true,
  playgroundPort: 5174,
})
