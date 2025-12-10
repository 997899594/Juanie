-- Migration: Add database indexes for performance optimization
-- Created: 2024-12-09
-- Purpose: Improve query performance for frequently accessed columns

-- ==================== Projects Table ====================

-- Index for organization queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_projects_organization_id 
ON projects(organization_id) 
WHERE deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_projects_status 
ON projects(status) 
WHERE deleted_at IS NULL;

-- Composite index for organization + status queries
CREATE INDEX IF NOT EXISTS idx_projects_org_status 
ON projects(organization_id, status) 
WHERE deleted_at IS NULL;

-- Index for created_by (audit and user project queries)
CREATE INDEX IF NOT EXISTS idx_projects_created_by 
ON projects(created_by) 
WHERE deleted_at IS NULL;

-- Index for slug lookups (unique constraint already provides index)
-- No additional index needed for slug

-- ==================== Project Members Table ====================

-- Index for user queries (find all projects for a user)
CREATE INDEX IF NOT EXISTS idx_project_members_user_id 
ON project_members(user_id);

-- Composite index for project + user lookups (permission checks)
CREATE INDEX IF NOT EXISTS idx_project_members_project_user 
ON project_members(project_id, user_id);

-- Index for role filtering
CREATE INDEX IF NOT EXISTS idx_project_members_role 
ON project_members(role);

-- ==================== Environments Table ====================

-- Index for project queries (most common)
CREATE INDEX IF NOT EXISTS idx_environments_project_id 
ON environments(project_id);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_environments_type 
ON environments(type);

-- Composite index for project + type queries
CREATE INDEX IF NOT EXISTS idx_environments_project_type 
ON environments(project_id, type);

-- ==================== Git Sync Logs Table ====================

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_git_sync_logs_project_id 
ON git_sync_logs(project_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_git_sync_logs_status 
ON git_sync_logs(status);

-- Index for time-based queries (DESC for recent logs first)
CREATE INDEX IF NOT EXISTS idx_git_sync_logs_created_at 
ON git_sync_logs(created_at DESC);

-- Composite index for project + status queries
CREATE INDEX IF NOT EXISTS idx_git_sync_logs_project_status 
ON git_sync_logs(project_id, status);

-- ==================== Repositories Table ====================

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_repositories_project_id 
ON repositories(project_id);

-- Index for provider filtering
CREATE INDEX IF NOT EXISTS idx_repositories_provider 
ON repositories(provider);

-- ==================== Deployments Table ====================

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_deployments_project_id 
ON deployments(project_id);

-- Index for environment queries
CREATE INDEX IF NOT EXISTS idx_deployments_environment_id 
ON deployments(environment_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_deployments_status 
ON deployments(status);

-- Index for time-based queries (DESC for recent deployments first)
CREATE INDEX IF NOT EXISTS idx_deployments_created_at 
ON deployments(created_at DESC);

-- Composite index for project + status queries
CREATE INDEX IF NOT EXISTS idx_deployments_project_status 
ON deployments(project_id, status);

-- ==================== Organization Members Table ====================

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
ON organization_members(user_id);

-- Composite index for organization + user lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user 
ON organization_members(organization_id, user_id);

-- Index for role filtering
CREATE INDEX IF NOT EXISTS idx_organization_members_role 
ON organization_members(role);

-- ==================== Team Members Table ====================

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_team_members_user_id 
ON team_members(user_id);

-- Composite index for team + user lookups
CREATE INDEX IF NOT EXISTS idx_team_members_team_user 
ON team_members(team_id, user_id);

-- ==================== Team Projects Table ====================

-- Index for team queries
CREATE INDEX IF NOT EXISTS idx_team_projects_team_id 
ON team_projects(team_id);

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_team_projects_project_id 
ON team_projects(project_id);

-- ==================== GitOps Resources Table ====================

-- Index for project queries
CREATE INDEX IF NOT EXISTS idx_gitops_resources_project_id 
ON gitops_resources(project_id);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_gitops_resources_type 
ON gitops_resources(type);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_gitops_resources_status 
ON gitops_resources(status);

-- Composite index for project + status queries
CREATE INDEX IF NOT EXISTS idx_gitops_resources_project_status 
ON gitops_resources(project_id, status);

-- ==================== Audit Logs Table ====================

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs(user_id);

-- Index for organization queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id 
ON audit_logs(organization_id);

-- Index for resource queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id 
ON audit_logs(resource_id);

-- Index for time-based queries (DESC for recent logs first)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON audit_logs(created_at DESC);

-- Composite index for resource + type queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type 
ON audit_logs(resource_type, resource_id);
