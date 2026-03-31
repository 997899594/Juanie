import { z } from 'zod';

export const releasePlanSchema = z.object({
  recommendation: z.object({
    strategy: z.enum(['rolling', 'controlled', 'canary', 'blue_green']),
    confidence: z.enum(['low', 'medium', 'high']),
    summary: z.string(),
    why: z.array(z.string()).min(1),
  }),
  risk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    primaryRisk: z.string(),
    contributingRisks: z.array(z.string()),
  }),
  checks: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      status: z.enum(['pass', 'warning', 'blocked']),
      summary: z.string(),
    })
  ),
  executionSteps: z.array(
    z.object({
      step: z.string(),
      type: z.enum(['migration', 'deploy', 'verify', 'approval', 'rollout']),
      required: z.boolean(),
    })
  ),
  rollbackPlan: z.object({
    summary: z.string(),
    target: z.string().nullable(),
    triggerSignals: z.array(z.string()),
  }),
  actions: z.object({
    canCreateRelease: z.boolean(),
    canStartRollout: z.boolean(),
    needsApproval: z.boolean(),
  }),
  operatorNarrative: z.string(),
});

export type ReleasePlan = z.infer<typeof releasePlanSchema>;
