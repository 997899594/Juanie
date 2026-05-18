import { describe, expect, it } from 'bun:test';
import { getDrizzlePushOutputFailure } from '@/lib/migrations/desired-schema';

describe('desired schema runner output guards', () => {
  it('fails non-interactive drizzle rename prompts instead of marking the run successful', () => {
    expect(
      getDrizzlePushOutputFailure(
        'error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false).'
      )
    ).toContain('非交互环境');
  });

  it('fails data-loss prompts instead of auto-reporting success', () => {
    expect(
      getDrizzlePushOutputFailure(
        'THIS ACTION WILL CAUSE DATA LOSS AND CANNOT BE REVERTED\nDo you still want to push changes?'
      )
    ).toContain('数据丢失');
  });

  it('allows normal drizzle output', () => {
    expect(getDrizzlePushOutputFailure('Changes applied')).toBe(null);
  });
});
