export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { startTelemetry } = await import('@/lib/telemetry/instrumentation');
  await startTelemetry('juanie-web');
}
