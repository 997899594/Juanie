import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

export function setupObservability() {
  // 使用 resourceFromAttributes 创建自定义资源，然后与默认资源合并
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'ai-devops-platform',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })

  const resource = defaultResource().merge(customResource)

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PrometheusExporter({
      port: 9464, // Prometheus 指标端口
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // 禁用不需要的
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // 启用需要的
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: false },
        '@opentelemetry/instrumentation-fastify': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  })

  sdk.start()
  console.log('✅ OpenTelemetry 已启动')
  console.log('📊 Prometheus 指标: http://localhost:9464/metrics')

  return sdk
}
