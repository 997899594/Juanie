import { defineConfig } from 'vitest/config'
import { domConfig } from './vitest.config'

/**
 * Vitest 配置 - DOM 环境
 * 用于前端测试
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { defineConfig, mergeConfig } from 'vitest/config'
 * import domConfig from '@juanie/config-vitest/dom'
 *
 * export default mergeConfig(
 *   domConfig,
 *   defineConfig({
 *     // 你的自定义配置
 *   })
 * )
 * ```
 */
export default defineConfig(domConfig)
