import { defineNitroPlugin } from 'nitropack/runtime'
import { getNestApp } from './nestjs'

export default defineNitroPlugin(async (nitroApp) => {
  try {
    const nestApp = await getNestApp()
    const configService = nestApp.get('ConfigService')

    const monitoringConfig = configService.getMonitoring()

    if (!monitoringConfig.tracingEnabled) {
      return
    }

    console.log(`OpenTelemetry enabled for service: ${configService.getApp().name}`)

    if (monitoringConfig.tracingEndpoint) {
      console.log(`OTLP endpoint: ${monitoringConfig.tracingEndpoint}`)
    }

    // 这里可以添加实际的 OpenTelemetry 初始化代码
    // 例如：
    // const { NodeSDK } = await import('@opentelemetry/sdk-node');
    // const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    //
    // const sdk = new NodeSDK({
    //   serviceName: configService.getApp().name,
    //   instrumentations: [getNodeAutoInstrumentations()],
    // });
    //
    // sdk.start();
  } catch (error) {
    console.warn('Failed to initialize OpenTelemetry:', error)
  }
})
