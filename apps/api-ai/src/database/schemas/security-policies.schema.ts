import { pgTable, serial, integer, text, timestamp, jsonb, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';
import { projects } from './projects.schema';

// 枚举定义
export const PolicyTypeEnum = z.enum(['access_control', 'data_protection', 'network', 'compliance']);
export const EnforcementLevelEnum = z.enum(['block', 'warn', 'log']);
export const ComplianceFrameworkEnum = z.enum(['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS']);

export const securityPolicies = pgTable('security_policies', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id),
  projectId: integer('project_id').references(() => projects.id),
  
  policyName: text('policy_name').notNull(),
  policyType: text('policy_type').notNull(), // 'access_control', 'data_protection', 'network', 'compliance'
  
  // 策略内容
  policyRules: jsonb('policy_rules').notNull(),
  enforcementLevel: text('enforcement_level').default('warn'), // 'block', 'warn', 'log'
  
  // 适用范围
  appliesTo: jsonb('applies_to').default({}), // 环境、服务、用户组等
  exceptions: jsonb('exceptions').default([]),
  
  // AI增强
  aiGenerated: boolean('ai_generated').default(false),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  autoUpdateEnabled: boolean('auto_update_enabled').default(false),
  
  // 合规框架
  complianceFrameworks: jsonb('compliance_frameworks').default([]), // 'SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const securityPoliciesOrganizationIdx = index('security_policies_organization_idx').on(securityPolicies.organizationId);
export const securityPoliciesProjectIdx = index('security_policies_project_idx').on(securityPolicies.projectId);
export const securityPoliciesTypeIdx = index('security_policies_type_idx').on(securityPolicies.policyType);
export const securityPoliciesEnforcementIdx = index('security_policies_enforcement_idx').on(securityPolicies.enforcementLevel);
export const securityPoliciesActiveIdx = index('security_policies_active_idx').on(securityPolicies.isActive);

// Relations
export const securityPoliciesRelations = relations(securityPolicies, ({ one }) => ({
  organization: one(organizations, {
    fields: [securityPolicies.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [securityPolicies.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertSecurityPolicySchema = createInsertSchema(securityPolicies);

export const selectSecurityPolicySchema = createSelectSchema(securityPolicies);

export const updateSecurityPolicySchema = insertSecurityPolicySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SecurityPolicy = typeof securityPolicies.$inferSelect;
export type NewSecurityPolicy = typeof securityPolicies.$inferInsert;
export type UpdateSecurityPolicy = z.infer<typeof updateSecurityPolicySchema>;
export type PolicyType = z.infer<typeof PolicyTypeEnum>;
export type EnforcementLevel = z.infer<typeof EnforcementLevelEnum>;
export type ComplianceFramework = z.infer<typeof ComplianceFrameworkEnum>;