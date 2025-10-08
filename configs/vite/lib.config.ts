import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export interface LibOptions {
  name: string
  external?: string[]
  input?: string
  // 🎯 新增：支持组件预览
  playground?: boolean
  playgroundPort?: number
}

export function createLibConfig(options: LibOptions) {
  const {
    name,
    external = ['vue'],
    input = 'src/index.ts',
    playground = false,
    playgroundPort = 5174,
  } = options

  return defineConfig({
    plugins: [
      vue(),
      dts({
        insertTypesEntry: true,
        rollupTypes: false, // 🎯 禁用以避免之前的错误
      }),
    ],

    // 🎯 条件设置 root
    ...(playground && {
      root: resolve(process.cwd(), 'playground'),
    }),

    build: {
      lib: {
        entry: resolve(process.cwd(), input),
        name,
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external,
      },
      sourcemap: true,
      outDir: resolve(process.cwd(), 'dist'),
      emptyOutDir: true,
    },

    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
        [`@${name.toLowerCase()}`]: resolve(process.cwd(), 'src/index.ts'),
      },
    },

    // 🎯 条件设置服务器
    ...(playground && {
      server: {
        port: playgroundPort,
        open: true,
      },
    }),
  })
}

export default createLibConfig
