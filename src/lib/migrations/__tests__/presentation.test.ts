import { describe, expect, it } from 'bun:test';
import { getReleaseMigrationPlanStatusLabel } from '@/lib/migrations/presentation';

describe('migration plan presentation', () => {
  it('does not present failed or superseded plans as approved', () => {
    expect(getReleaseMigrationPlanStatusLabel('failed')).toBe('执行失败');
    expect(getReleaseMigrationPlanStatusLabel('superseded')).toBe('已被后续发布取代');
    expect(getReleaseMigrationPlanStatusLabel('executing')).toBe('执行中');
  });
});
