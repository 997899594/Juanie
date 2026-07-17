export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.OTEL_SDK_DISABLED === 'true' ||
    !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim()
  ) {
    return;
  }

  const { startTelemetry } = await import('@/lib/telemetry/instrumentation');
  await startTelemetry('juanie-web');
}
