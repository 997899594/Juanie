import { describe, expect, it } from 'bun:test';
import { startTelemetry } from '@/lib/telemetry/instrumentation';

describe('telemetry runtime boundary', () => {
  it('does not load or initialize OpenTelemetry without an exporter endpoint', async () => {
    const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

    try {
      expect(await startTelemetry('juanie-test')).toBeUndefined();
    } finally {
      if (originalEndpoint === undefined) {
        delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
      } else {
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = originalEndpoint;
      }
    }
  });
});
