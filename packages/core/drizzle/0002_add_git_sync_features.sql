-- 添加项目成员 Git 同步状态字段
-- 用于支持个人工作空间的项目级协作
ALTER TABLE "project_members" ADD COLUMN "git_sync_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "git_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "git_sync_error" text;--> statement-breakpoint

-- 添加组织类型和所有者字段
-- 用于支持个人工作空间
ALTER TABLE "organizations" ADD COLUMN "type" text DEFAULT 'team';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "owner_id" uuid;--> statement-breakpoint

-- 添加组织 Git 同步字段
-- 用于支持团队工作空间的组织级同步
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_provider" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_org_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_org_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_org_url" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_sync_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "git_last_sync_at" timestamp;--> statement-breakpoint

-- 添加外键约束
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "orgs_git_provider_idx" ON "organizations"("git_provider");--> statement-breakpoint

-- 创建 Git 同步日志表
-- 记录所有 Git 平台同步操作，包括成功和失败
CREATE TABLE IF NOT EXISTS "git_sync_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sync_type" text NOT NULL,
  "action" text NOT NULL,
  "project_id" uuid,
  "user_id" uuid,
  "organization_id" uuid,
  "provider" text NOT NULL,
  "git_resource_id" text,
  "git_resource_url" text,
  "git_resource_type" text,
  "status" text NOT NULL,
  "error" text,
  "error_type" text,
  "error_stack" text,
  "requires_resolution" boolean DEFAULT false,
  "resolved" boolean DEFAULT false,
  "resolved_at" timestamp,
  "resolved_by" uuid,
  "resolution_notes" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);--> statement-breakpoint

-- 添加外键约束
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_sync_logs" ADD CONSTRAINT "git_sync_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "git_sync_logs_status_idx" ON "git_sync_logs"("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_sync_type_idx" ON "git_sync_logs"("sync_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_provider_idx" ON "git_sync_logs"("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_organization_id_idx" ON "git_sync_logs"("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_project_id_idx" ON "git_sync_logs"("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_created_at_idx" ON "git_sync_logs"("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_requires_resolution_idx" ON "git_sync_logs"("requires_resolution") WHERE "requires_resolution" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "git_sync_logs_resolved_idx" ON "git_sync_logs"("resolved") WHERE "resolved" = false;
