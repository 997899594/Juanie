import { z } from 'zod';

export const juaniePluginManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['core', 'workspace', 'external', 'mcp']),
  scope: z.enum(['global', 'team', 'project', 'environment', 'release']),
  capabilities: z.array(z.string().min(1)),
  skills: z.array(z.string().min(1)),
  tools: z.array(z.string().min(1)),
  actions: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        toolId: z.string().min(1),
        surface: z.enum(['action-center', 'task-center']),
        reason: z.string().min(1),
        requiresConfirmation: z.boolean(),
      })
    )
    .default([]),
  contextProviders: z.array(z.string().min(1)),
  surfaces: z.array(z.enum(['copilot-panel', 'inline-card', 'action-center', 'task-center'])),
  permissions: z.object({
    level: z.enum(['read', 'write', 'dangerous']),
    requiresAudit: z.boolean(),
  }),
});

export type JuaniePluginManifestInput = z.input<typeof juaniePluginManifestSchema>;
