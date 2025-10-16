import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'path'

export default defineNitroConfig({
  srcDir: '.',
  compatibilityDate: '2024-11-01',
  alias: {
    '~': resolve('./src'),
    '@': resolve('./src'),
  },
  plugins: ['~/plugins/nestjs.ts'],
  typescript: {
    tsConfig: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
})
