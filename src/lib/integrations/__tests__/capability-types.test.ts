import { describe, expect, it } from 'bun:test';
import { CAPABILITIES } from '@/lib/integrations/domain/models';

describe('integration capability catalog', () => {
  it('includes workflow and webhook capabilities', () => {
    expect(CAPABILITIES).toContain('write_workflow');
    expect(CAPABILITIES).toContain('manage_webhook');
  });
});
