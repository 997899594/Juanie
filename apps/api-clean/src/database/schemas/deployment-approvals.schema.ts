import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { deployments } from './deployments.schema';
import { users } from './users.schema';

export const deploymentApprovals = pgTable('deployment_approvals', {
    id: uuid('id').primaryKey().defaultRandom(),
    deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
    approverId: uuid('approver_id').notNull().references(() => users.id),
    status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
    comments: text('comments'),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('approvals_deployment_idx').on(table.deploymentId),
    index('approvals_status_idx').on(table.status),
]);

export type DeploymentApproval = typeof deploymentApprovals.$inferSelect;
export type NewDeploymentApproval = typeof deploymentApprovals.$inferInsert;
