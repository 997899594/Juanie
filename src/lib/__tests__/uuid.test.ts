import { describe, expect, it } from 'bun:test';
import { isUuid } from '@/lib/uuid';

describe('uuid helpers', () => {
  it('accepts canonical uuids and rejects route literals', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(isUuid('new')).toBe(false);
    expect(isUuid('settings')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
