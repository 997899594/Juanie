import { describe, expect, it } from 'bun:test';
import { chooseDefaultBinding } from '@/lib/integrations/service/team-binding-service';

describe('team integration binding service', () => {
  it('prefers the explicit default active binding', () => {
    expect(
      chooseDefaultBinding([
        { id: 'a', isDefault: false, revokedAt: null },
        { id: 'b', isDefault: true, revokedAt: null },
      ])?.id
    ).toBe('b');
  });

  it('ignores revoked default binding and falls back to active binding', () => {
    expect(
      chooseDefaultBinding([
        { id: 'a', isDefault: true, revokedAt: new Date() },
        { id: 'b', isDefault: false, revokedAt: null },
      ])?.id
    ).toBe('b');
  });
});
