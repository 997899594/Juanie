import { z } from 'zod';

export const envvarRiskSchema = z.object({
  headline: z.object({
    status: z.enum(['healthy', 'attention', 'risk']),
    summary: z.string(),
    nextAction: z.string().nullable(),
  }),
  coverage: z.object({
    directCount: z.number().int().nonnegative(),
    effectiveCount: z.number().int().nonnegative(),
    inheritedCount: z.number().int().nonnegative(),
    secretCount: z.number().int().nonnegative(),
    serviceOverrideGroupCount: z.number().int().nonnegative(),
    summary: z.string(),
  }),
  risks: z.array(z.string()).min(1).max(4),
  operatorNarrative: z.string(),
});

export type EnvvarRisk = z.infer<typeof envvarRiskSchema>;
