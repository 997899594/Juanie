import { z } from 'zod';

export const migrationReviewSchema = z.object({
  headline: z.object({
    status: z.enum(['healthy', 'attention', 'risk']),
    summary: z.string(),
    nextAction: z.string().nullable(),
  }),
  migration: z.object({
    totalRuns: z.number().int().nonnegative(),
    awaitingApprovalCount: z.number().int().nonnegative(),
    awaitingExternalCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    latestStatusLabel: z.string().nullable(),
    summary: z.string(),
  }),
  schema: z.object({
    databaseCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    summary: z.string(),
  }),
  focusPoints: z.array(z.string()).min(1).max(4),
  operatorNarrative: z.string(),
});

export type MigrationReview = z.infer<typeof migrationReviewSchema>;
