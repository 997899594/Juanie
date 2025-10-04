import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export interface LibOptions {
  name: string
  external?: string[]
  inputs?: string[]
}

export default function createLibConfig(options: LibOptions) {
  const { name, external = ['vue'], inputs = ['src/index.ts'] } = options
  const firstEntry = resolve(process.cwd(), inputs[0])
  const extraInputs = inputs.length > 1 ? inputs.slice(1).map((p) => resolve(process.cwd(), p)) : []

  return defineConfig({
    plugins: [vue(), dts({ insertTypesEntry: true })],
    build: {
      lib: {
        entry: firstEntry,
        name,
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external,
        input: extraInputs.length ? [firstEntry, ...extraInputs] : undefined,
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
        },
      },
    },
  })
}
