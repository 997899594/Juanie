import type { NitroAppPlugin } from 'nitropack'
import { logger } from '../src/middleware/logger.middleware'

const plugin: NitroAppPlugin = async (nitroApp) => {
  if (process.env.OTEL_ENABLED !== 'true') {
    return
  }

  try {
    // 动态加载，避免未安装时报错
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const sdk = new NodeSDK()
    await sdk.start()
    logger.debug('OpenTelemetry started.')

    nitroApp.hooks.hook('close', async () => {
      try {
        await sdk.shutdown()
        logger.debug('OpenTelemetry shutdown.')
      } catch (e) {
        logger.error('OTEL shutdown failed', { error: e instanceof Error ? e.message : String(e) })
      }
    })
  } catch (e) {
    logger.warn('OpenTelemetry init failed (dependency not installed or config error).', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export default plugin
