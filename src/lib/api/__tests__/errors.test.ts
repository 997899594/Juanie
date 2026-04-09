import { describe, expect, it } from 'bun:test';
import { accessError } from '@/lib/api/errors';

describe('api access errors', () => {
  it('normalizes forbidden responses', () => {
    expect(accessError('forbidden').status).toBe(403);
  });
});
