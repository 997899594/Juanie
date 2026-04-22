import { z } from 'zod';

export const dynamicPluginOutputSchema = z.object({
  headline: z.object({
    title: z.string(),
    summary: z.string(),
    tone: z.enum(['calm', 'warning', 'critical']),
  }),
  findings: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
    })
  ),
  nextActions: z.array(
    z.object({
      actionId: z.string().nullable().optional(),
      label: z.string(),
      summary: z.string(),
    })
  ),
  evidenceUsed: z.array(z.string()),
});

export type DynamicPluginOutput = z.infer<typeof dynamicPluginOutputSchema>;
