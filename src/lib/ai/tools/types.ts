import type { AIPluginPermissionLevel, AIPluginScope } from '@/lib/ai/runtime/types';

export interface JuanieToolDefinition {
  id: string;
  title: string;
  description: string;
  scope: Exclude<AIPluginScope, 'global'>;
  riskLevel: AIPluginPermissionLevel;
  auditLabel?: string;
  requiresAudit: boolean;
  requiresReason?: boolean;
  requiresApprovalToken?: boolean;
}
