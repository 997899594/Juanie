-- 添加新字段
ALTER TABLE "oauth_accounts" ADD COLUMN "server_url" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "server_type" text;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "metadata" jsonb;--> statement-breakpoint

-- 为现有 GitHub 账户设置默认值
UPDATE "oauth_accounts" 
SET 
  "server_url" = 'https://github.com',
  "server_type" = 'cloud',
  "metadata" = '{}'::jsonb
WHERE "provider" = 'github' AND "server_url" IS NULL;--> statement-breakpoint

-- 为现有 GitLab 账户设置默认值
UPDATE "oauth_accounts" 
SET 
  "server_url" = 'https://gitlab.com',
  "server_type" = 'cloud',
  "metadata" = '{}'::jsonb
WHERE "provider" = 'gitlab' AND "server_url" IS NULL;--> statement-breakpoint

-- 删除旧的唯一约束
DROP INDEX IF EXISTS "oauth_accounts_user_id_provider_unique";--> statement-breakpoint

-- 创建新的唯一约束（包含 server_url）
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_user_id_provider_server_url_unique" 
ON "oauth_accounts" ("user_id", "provider", "server_url");