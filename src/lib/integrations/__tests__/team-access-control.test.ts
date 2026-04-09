import { describe, expect, it } from 'bun:test';
import { statusByCode } from '@/lib/integrations/service/integration-control-plane';

describe('team integration control plane', () => {
  it('treats missing team binding as not found', () => {
    expect(statusByCode('INTEGRATION_NOT_BOUND')).toBe(404);
  });
});
