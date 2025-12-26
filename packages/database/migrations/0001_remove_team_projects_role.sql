-- Migration: Remove team_projects.role column
-- Date: 2025-12-24
-- Description: 删除 team_projects 表的 role 字段，改用团队成员角色直接映射

-- 备份现有数据（如果需要回滚）
-- CREATE TABLE team_projects_backup AS SELECT * FROM team_projects;

-- 删除 role 字段
ALTER TABLE team_projects DROP COLUMN IF EXISTS role;

-- 注释：权限计算规则
-- team owner/maintainer → project maintainer
-- team member → project developer
