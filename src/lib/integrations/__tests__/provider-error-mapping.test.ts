import { describe, expect, it } from 'bun:test';
import { mapProviderError } from '@/lib/integrations/service/integration-control-plane';

describe('mapProviderError', () => {
  it('maps provider 404 to PROVIDER_RESOURCE_NOT_FOUND', () => {
    const err = mapProviderError({ status: 404, message: 'Not Found' });
    expect(err.code).toBe('PROVIDER_RESOURCE_NOT_FOUND');
  });
});
