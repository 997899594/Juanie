import { defineConfig } from 'vitest/config'
import { nodeConfig } from './vitest.config'

/**
 * Vitest 配置 - Node 环境
 * 用于后端测试
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { defineConfig, mergeConfig } from 'vitest/config'
 * import nodeConfig from '@juanie/config-vitest/node'
 *
 * export default mergeConfig(
 *   nodeConfig,
 *   defineConfig({
 *     // 你的自定义配置
 *   })
 * )
 * ```
 */
export default defineConfig(nodeConfig)
