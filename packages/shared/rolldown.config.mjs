import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
  },
  external: ['vue'],
  resolve: {
    extensions: ['.ts', '.js'],
  },
})
