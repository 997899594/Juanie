-- Migration: Add git_credentials table
-- Description: Store long-lived Git credentials (Project Access Tokens / Deploy Keys)
-- Date: 2025-11-25

-- Create git_credentials table
CREATE TABLE IF NOT EXISTS git_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Credential type: 'gitlab_project_token', 'gitlab_deploy_token', 'github_deploy_key'
  type TEXT NOT NULL,
  
  -- GitLab specific fields
  gitlab_token_id TEXT,
  gitlab_project_id TEXT,
  
  -- GitHub specific fields
  github_key_id TEXT,
  github_repo_full_name TEXT,
  
  -- Common fields
  token TEXT NOT NULL, -- Encrypted storage recommended
  scopes JSONB,
  expires_at TIMESTAMP, -- NULL = never expires
  revoked_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_git_credentials_project_id ON git_credentials(project_id);
CREATE INDEX IF NOT EXISTS idx_git_credentials_type ON git_credentials(type);
CREATE INDEX IF NOT EXISTS idx_git_credentials_revoked ON git_credentials(revoked_at) WHERE revoked_at IS NULL;

-- Add comments
COMMENT ON TABLE git_credentials IS 'Long-lived Git credentials for GitOps (Project Access Tokens / Deploy Keys)';
COMMENT ON COLUMN git_credentials.type IS 'Credential type: gitlab_project_token, gitlab_deploy_token, github_deploy_key';
COMMENT ON COLUMN git_credentials.token IS 'Encrypted token or private key';
COMMENT ON COLUMN git_credentials.expires_at IS 'NULL means never expires';
