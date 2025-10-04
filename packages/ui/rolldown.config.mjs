import { resolve } from 'node:path'
import { defineConfig } from 'rolldown'

// 使用 Rolldown 构建多入口，并保持输出文件名为 src/[name].js
export default defineConfig({
  input: {
    index: resolve(process.cwd(), 'src/index.ts'),
    theme: resolve(process.cwd(), 'src/theme.ts'),
    'naive-ui': resolve(process.cwd(), 'src/naive-ui.ts'),
    'tokens/types': resolve(process.cwd(), 'src/tokens/types.ts'),
    'tokens/bilibili': resolve(process.cwd(), 'src/tokens/bilibili.ts'),
    'themes/bilibili': resolve(process.cwd(), 'src/themes/bilibili.ts'),
  },
  external: ['vue', 'naive-ui'],
  output: {
    dir: resolve(process.cwd(), 'dist'),
    format: 'esm',
    entryFileNames: (chunk) => {
      // 将入口名映射到 src/[name].js，以匹配 package.json exports 指向的路径
      const name = chunk.name
      return `src/${name}.js`
    },
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
})
