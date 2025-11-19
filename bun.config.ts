import type { BunPlugin } from 'bun'

/**
 * Bun 运行时优化配置
 * 2025 最佳实践 - 极速启动和运行时性能
 */
export const bunConfig = {
  // 预加载模块，提升启动速度
  preload: ['./src/app.module.ts', './src/trpc/context.ts'],

  // 启用 Bun 原生优化
  target: 'bun',

  // 环境变量
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    BUN_ENV: 'true',
  },

  // 插件配置
  plugins: [] as BunPlugin[],

  // 性能优化
  define: {
    'process.env.BUN_RUNTIME': '"true"',
  },
}

export default bunConfig
