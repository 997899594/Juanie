import { describe, expect, it } from 'bun:test';
import { CAPABILITIES } from '@/lib/integrations/domain/models';

describe('integration capability catalog', () => {
  it('includes workflow capability', () => {
    expect(CAPABILITIES).toContain('write_workflow');
  });
});
