-- 数据库重构：删除旧表 oauth_accounts 和 user_git_accounts
-- 这些表已合并到 git_connections 表

-- Step 1: 清理 project_git_auth 表中的外键约束
ALTER TABLE "project_git_auth" DROP CONSTRAINT IF EXISTS "project_git_auth_oauth_account_id_oauth_accounts_id_fk";

-- Step 2: 清空 project_git_auth 表（开发阶段，直接删除）
TRUNCATE TABLE "project_git_auth" CASCADE;

-- Step 3: 删除旧表
DROP TABLE IF EXISTS "oauth_accounts" CASCADE;
DROP TABLE IF EXISTS "user_git_accounts" CASCADE;

-- Step 4: 添加新的外键约束，指向 git_connections
ALTER TABLE "project_git_auth" 
  ADD CONSTRAINT "project_git_auth_oauth_account_id_git_connections_id_fk" 
  FOREIGN KEY ("oauth_account_id") 
  REFERENCES "public"."git_connections"("id") 
  ON DELETE SET NULL 
  ON UPDATE NO ACTION;
