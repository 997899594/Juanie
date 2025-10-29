import { nodeConfig } from '@juanie/config-vitest/node'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ...nodeConfig,
  test: {
    ...nodeConfig.test,
    name: 'service-pipelines',
  },
})
