import { defineNitroPlugin } from 'nitropack/runtime'
import { getConfig } from '@/core/config/nitro'

export default defineNitroPlugin(async (nitroApp) => {
  const config = getConfig()

  if (!config.monitoring.tracingEnabled) {
    return
  }

  console.log(`OpenTelemetry enabled for service: ${config.app.name}`)

  if (config.monitoring.tracingEndpoint) {
    console.log(`OTLP endpoint: ${config.monitoring.tracingEndpoint}`)
  }

  // 这里可以添加实际的 OpenTelemetry 初始化代码
  // 例如：
  // const { NodeSDK } = await import('@opentelemetry/sdk-node');
  // const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  //
  // const sdk = new NodeSDK({
  //   serviceName: config.app.name,
  //   instrumentations: [getNodeAutoInstrumentations()],
  // });
  //
  // sdk.start();
})
