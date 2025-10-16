import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'path'

export default defineNitroConfig({
  srcDir: '.',
  compatibilityDate: '2025-01-14',
  alias: {
    '@': resolve(__dirname, './src'),
  },
  // Note: CORS is handled entirely in route handlers for precise control
  // No global CORS rules - each route manages its own CORS policy
  storage: {
    redis: { driver: 'redis' },
  },
  plugins: [
    '~/plugins/nestjs.ts',
    // "~/plugins/otel.ts",
  ],
  esbuild: {
    options: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    },
  },
})
