import { describe, expect, it } from 'bun:test';
import { getMonthlyTokenLimit } from '@/lib/ai/runtime/token-budget';

describe('AI token budgets', () => {
  it('assigns increasing monthly limits by plan', () => {
    expect(getMonthlyTokenLimit('free') < getMonthlyTokenLimit('pro')).toBe(true);
    expect(getMonthlyTokenLimit('pro') < getMonthlyTokenLimit('scale')).toBe(true);
    expect(getMonthlyTokenLimit('scale') < getMonthlyTokenLimit('enterprise')).toBe(true);
  });
});
