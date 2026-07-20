import { z } from 'zod';
import { turboQueryVersion } from '@/lib/monorepo/turbo-analysis';

const commitShaSchema = z.string().regex(/^[a-f0-9]{40}$/u);

const turboAnalysisBaseSchema = z.object({
  engine: z.literal('turbo'),
  engineVersion: z.literal(turboQueryVersion),
  sourceSha: commitShaSchema,
  baseSha: commitShaSchema,
});

export const turboAnalysisFactsSchema = z.discriminatedUnion('status', [
  turboAnalysisBaseSchema
    .extend({
      status: z.literal('complete'),
      mode: z.enum(['packages', 'tasks']),
      task: z.string().min(1).max(100).optional(),
      workspacePackages: z.array(z.string().min(1).max(214)).max(1000),
      affectedPackages: z.array(z.string().min(1).max(214)).max(500),
    })
    .strict(),
  turboAnalysisBaseSchema
    .extend({
      status: z.literal('failed'),
      error: z.string().min(1).max(500),
    })
    .strict(),
]);

export const buildRunRequestBaseSchema = z
  .object({
    repository: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[^/\s]+\/[^/\s]+$/u),
    ref: z.string().min(1).max(255),
    sha: commitShaSchema,
    beforeSha: commitShaSchema.optional().nullable(),
    provider: z.enum(['github', 'gitlab', 'gitlab-self-hosted']),
    externalRunId: z.string().min(1).max(255).optional().nullable(),
    forceFullBuild: z.boolean().optional().default(false),
  })
  .strict();

export const startBuildRunSchema = buildRunRequestBaseSchema.extend({
  monorepoAnalysis: turboAnalysisFactsSchema.optional(),
});

export type TurboAnalysisFacts = z.infer<typeof turboAnalysisFactsSchema>;
