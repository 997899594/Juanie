import { z } from 'zod';

export const environmentSummarySchema = z.object({
  headline: z.object({
    status: z.enum(['healthy', 'attention', 'risk']),
    summary: z.string(),
    nextAction: z.string().nullable(),
  }),
  access: z.object({
    primaryUrl: z.string().nullable(),
    domains: z.array(z.string()),
  }),
  sourceOfTruth: z.object({
    scopeLabel: z.string().nullable(),
    sourceLabel: z.string().nullable(),
    gitSummary: z.string().nullable(),
  }),
  currentVersion: z.object({
    title: z.string().nullable(),
    shortCommitSha: z.string().nullable(),
    createdAtLabel: z.string().nullable(),
    statusLabel: z.string().nullable(),
  }),
  resources: z.object({
    databaseSummary: z.string(),
    variableSummary: z.string(),
  }),
  lifecycle: z.object({
    deploymentStrategy: z.string().nullable(),
    databaseStrategy: z.string().nullable(),
    cleanupSummary: z.string().nullable(),
    previewSummary: z.string().nullable(),
  }),
  focusPoints: z.array(z.string()).min(1).max(4),
  operatorNarrative: z.string(),
});

export type EnvironmentSummary = z.infer<typeof environmentSummarySchema>;
