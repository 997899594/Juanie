import type { AIPlan } from '@/lib/db/schema';

const defaultMonthlyLimits: Record<AIPlan, number> = {
  free: 100_000,
  pro: 2_000_000,
  scale: 10_000_000,
  enterprise: 100_000_000,
};

export function getMonthlyTokenLimit(plan: AIPlan): number {
  const override = process.env[`AI_MONTHLY_TOKEN_LIMIT_${plan.toUpperCase()}`];
  if (!override) {
    return defaultMonthlyLimits[plan];
  }
  const parsed = Number.parseInt(override, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`AI_MONTHLY_TOKEN_LIMIT_${plan.toUpperCase()} must be a positive integer`);
  }
  return parsed;
}
