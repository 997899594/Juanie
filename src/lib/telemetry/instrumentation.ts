import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;

export async function startTelemetry(serviceName: string): Promise<void> {
  if (sdk || process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  sdk = new NodeSDK({
    serviceName,
    ...(endpoint ? { traceExporter: new OTLPTraceExporter({ url: endpoint }) } : {}),
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
