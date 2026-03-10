import { describe, expect, it } from 'bun:test';
import { assertCapabilities } from '@/lib/integrations/service/session-service';

describe('assertCapabilities', () => {
  it('throws missing capability error when required capability absent', () => {
    expect(() => assertCapabilities(['read_repo'], ['write_workflow'])).toThrow(
      'MISSING_CAPABILITY(write_workflow)'
    );
  });
});
