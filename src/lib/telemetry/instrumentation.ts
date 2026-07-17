import type { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;

export async function startTelemetry(serviceName: string): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (sdk || process.env.OTEL_SDK_DISABLED === 'true' || !endpoint) {
    return;
  }

  const [{ getNodeAutoInstrumentations }, { OTLPTraceExporter }, { NodeSDK }] = await Promise.all([
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/sdk-node'),
  ]);
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
}

export async function stopTelemetry(): Promise<void> {
  const activeSdk = sdk;
  sdk = null;
  await activeSdk?.shutdown();
}
