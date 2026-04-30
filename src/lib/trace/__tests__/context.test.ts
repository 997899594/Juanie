import { describe, expect, it } from 'bun:test';
import { buildTraceLogFields, createTraceId } from '@/lib/trace/context';

describe('trace context', () => {
  it('uses uuid-like resource ids as stable trace ids', () => {
    expect(createTraceId('917e904b-27a2-435e-b010-eca066a06015')).toBe(
      '917e904b27a2435eb010eca066a06015'
    );
  });

  it('builds log fields with a W3C traceparent', () => {
    const fields = buildTraceLogFields({
      releaseId: '917e904b-27a2-435e-b010-eca066a06015',
      jobId: 'release-1',
      queue: 'release',
    });

    expect(fields.traceId).toBe('917e904b27a2435eb010eca066a06015');
    expect(/^00-917e904b27a2435eb010eca066a06015-[a-f0-9]{16}-01$/.test(fields.traceparent)).toBe(
      true
    );
    expect(fields.queue).toBe('release');
  });
});
