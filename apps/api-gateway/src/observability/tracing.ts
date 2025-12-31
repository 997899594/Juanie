import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

/**
 * 设置 OpenTelemetry 可观测性
 * 包括分布式追踪和 Prometheus 指标
 */
export function setupObservability() {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'api-gateway',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PrometheusExporter({
      port: 9465, // API Gateway 使用不同的端口（原 API 用 9464）
    }),
    instrumentations: [
      // Pino 日志自动注入 traceId/spanId
      new PinoInstrumentation(),
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

  return sdk
}
