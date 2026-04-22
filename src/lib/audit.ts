import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

export type AuditAction =
  | 'ai.plugin_executed'
  | 'ai.task_requested'
  | 'ai.tool_executed'
  | 'environment.copilot_asked'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'deployment.triggered'
  | 'deployment.rolled_back'
  | 'release.copilot_asked'
  | 'release.ai_analysis_refreshed'
  | 'environment.ai_summary_refreshed'
  | 'environment.created'
  | 'environment.preview_deleted'
  | 'environment.preview_cleanup_completed'
  | 'environment.remediation_triggered'
  | 'team.ai_control_plane_updated'
  | 'team.member_added'
  | 'team.member_removed'
  | 'team.member_role_changed'
  | 'cluster.added'
  | 'cluster.removed'
  | 'git_connected';

export type ResourceType =
  | 'project'
  | 'deployment'
  | 'release'
  | 'environment'
  | 'team'
  | 'member'
  | 'cluster'
  | 'git_connection';

interface AuditLogParams {
  teamId: string;
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditLogParams) {
  const [log] = await db
    .insert(auditLogs)
    .values({
      teamId: params.teamId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
    })
    .returning();

  return log;
}

export async function getAuditLogs(
  teamId: string,
  options?: {
    limit?: number;
    offset?: number;
    resourceType?: ResourceType;
    action?: AuditAction;
  }
) {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.teamId, teamId))
    .orderBy(auditLogs.createdAt)
    .limit(limit)
    .offset(offset);

  return logs;
}

export function formatAuditAction(action: AuditAction): string {
  const actionLabels: Record<AuditAction, string> = {
    'ai.plugin_executed': 'executed AI plugin',
    'ai.task_requested': 'requested AI task',
    'ai.tool_executed': 'executed AI tool',
    'environment.copilot_asked': 'asked environment copilot',
    'project.created': 'created project',
    'project.updated': 'updated project',
    'project.deleted': 'deleted project',
    'deployment.triggered': 'triggered deployment',
    'deployment.rolled_back': 'rolled back deployment',
    'release.copilot_asked': 'asked release copilot',
    'release.ai_analysis_refreshed': 'refreshed release AI analysis',
    'environment.ai_summary_refreshed': 'refreshed environment AI summary',
    'environment.created': 'created environment',
    'environment.preview_deleted': 'deleted preview environment',
    'environment.preview_cleanup_completed': 'completed preview cleanup',
    'environment.remediation_triggered': 'triggered environment remediation',
    'team.ai_control_plane_updated': 'updated AI control plane',
    'team.member_added': 'added team member',
    'team.member_removed': 'removed team member',
    'team.member_role_changed': 'changed member role',
    'cluster.added': 'added cluster',
    'cluster.removed': 'removed cluster',
    git_connected: 'connected git provider',
  };

  return actionLabels[action] || action;
}
