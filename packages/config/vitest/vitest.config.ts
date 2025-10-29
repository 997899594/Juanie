import type { UserConfig } from 'vitest/config'

/**
 * Vitest 基础配置
 */
export const baseConfig: UserConfig = {
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/test/**',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
}

/**
 * Vitest 配置 - Node 环境
 * 用于后端测试（如 apps/api, packages/services/*）
 */
export const nodeConfig: UserConfig = {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
  },
}

/**
 * Vitest 配置 - DOM 环境
 * 用于前端测试（如 apps/web, packages/ui）
 */
export const domConfig: UserConfig = {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'jsdom',
  },
}
