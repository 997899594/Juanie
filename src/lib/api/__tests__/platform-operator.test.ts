import { describe, expect, it } from 'bun:test';
import { isPlatformOperator } from '@/lib/api/access';

describe('platform operator access', () => {
  it('does not confuse team ownership with platform operations authority', () => {
    expect(isPlatformOperator('operator')).toBe(true);
    expect(isPlatformOperator('user')).toBe(false);
    expect(isPlatformOperator('owner')).toBe(false);
    expect(isPlatformOperator(undefined)).toBe(false);
  });
});
