import { describe, expect, it } from 'bun:test';
import { normalizeApiError } from '@/lib/integrations/service/integration-control-plane';

describe('api error normalization', () => {
  it('exposes structured missing capability error', () => {
    const error = normalizeApiError({ code: 'MISSING_CAPABILITY', capability: 'read_repo' });
    expect(error.error.code).toBe('MISSING_CAPABILITY(read_repo)');
  });

  it('keeps explicit team access denial codes intact', () => {
    const error = normalizeApiError({ code: 'TEAM_ACCESS_DENIED' });
    expect(error.error.code).toBe('TEAM_ACCESS_DENIED');
  });
});
