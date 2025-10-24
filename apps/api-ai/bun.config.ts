import { defineConfig } from 'bun';

export default defineConfig({
  entrypoints: ['./src/main.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  splitting: true,
  sourcemap: 'external',
  minify: process.env.NODE_ENV === 'production',
  external: [
    '@nestjs/core',
    '@nestjs/common',
    '@nestjs/platform-fastify',
    'fastify',
    'reflect-metadata',
    'rxjs',
    'class-transformer',
    'class-validator'
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});