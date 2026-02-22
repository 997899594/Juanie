import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

export type AuditAction =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'deployment.triggered'
  | 'deployment.rolled_back'
  | 'environment.created'
  | 'team.member_added'
  | 'team.member_removed'
  | 'team.member_role_changed'
  | 'cluster.added'
  | 'cluster.removed'
  | 'git_connected'
  | 'webhook.created'
  | 'webhook.deleted';

export type ResourceType =
  | 'project'
  | 'deployment'
  | 'environment'
  | 'team'
  | 'member'
  | 'cluster'
  | 'git_connection'
  | 'webhook';

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
    'project.created': 'created project',
    'project.updated': 'updated project',
    'project.deleted': 'deleted project',
    'deployment.triggered': 'triggered deployment',
    'deployment.rolled_back': 'rolled back deployment',
    'environment.created': 'created environment',
    'team.member_added': 'added team member',
    'team.member_removed': 'removed team member',
    'team.member_role_changed': 'changed member role',
    'cluster.added': 'added cluster',
    'cluster.removed': 'removed cluster',
    git_connected: 'connected git provider',
    'webhook.created': 'created webhook',
    'webhook.deleted': 'deleted webhook',
  };

  return actionLabels[action] || action;
}
