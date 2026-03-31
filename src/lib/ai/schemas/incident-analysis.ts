import { z } from 'zod';

export const incidentAnalysisSchema = z.object({
  diagnosis: z.object({
    rootCause: z.string(),
    category: z.enum([
      'capacity_blocked',
      'image_pull_failed',
      'probe_failed',
      'migration_blocked',
      'runtime_unhealthy',
      'unknown',
    ]),
    confidence: z.enum(['low', 'medium', 'high']),
    summary: z.string(),
  }),
  causalChain: z.array(
    z.object({
      at: z.string().nullable(),
      event: z.string(),
      impact: z.string(),
    })
  ),
  evidence: z.array(
    z.object({
      source: z.enum(['release', 'migration', 'deployment', 'k8s_event', 'governance']),
      summary: z.string(),
    })
  ),
  actions: z.object({
    safe: z.array(
      z.object({
        key: z.enum(['cleanup_terminating_pods', 'restart_deployments']),
        label: z.string(),
        summary: z.string(),
      })
    ),
    manual: z.array(
      z.object({
        label: z.string(),
        summary: z.string(),
      })
    ),
  }),
  operatorNarrative: z.string(),
});

export type IncidentAnalysis = z.infer<typeof incidentAnalysisSchema>;
