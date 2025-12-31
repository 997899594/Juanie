-- Migration: Add project initialization steps table
-- Date: 2025-01-01
-- Description: 
--   - Drop and recreate project_initialization_steps table with correct schema
--   - Supports step-by-step progress tracking with detailed status and timing
--   - Enables page refresh recovery and audit trail

-- Drop existing table if it exists (with CASCADE to remove dependencies)
DROP TABLE IF EXISTS project_initialization_steps CASCADE;

-- Create project_initialization_steps table with correct schema
CREATE TABLE project_initialization_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Step information
  step TEXT NOT NULL,
  parent_step TEXT,
  display_name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  
  -- Status information
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  
  -- Timing information
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  
  -- Error information
  error TEXT,
  error_stack TEXT,
  
  -- Metadata
  metadata JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX project_initialization_steps_project_id_idx 
  ON project_initialization_steps(project_id);

CREATE INDEX project_initialization_steps_project_step_idx 
  ON project_initialization_steps(project_id, step);

CREATE INDEX project_initialization_steps_status_idx 
  ON project_initialization_steps(status);

CREATE INDEX project_initialization_steps_sequence_idx 
  ON project_initialization_steps(project_id, sequence);

-- Add comments
COMMENT ON TABLE project_initialization_steps IS 'Tracks detailed progress of project initialization';
COMMENT ON COLUMN project_initialization_steps.step IS 'Step identifier (e.g., resolve_credentials, create_repository)';
COMMENT ON COLUMN project_initialization_steps.parent_step IS 'Parent step for sub-steps (e.g., push_template -> render_template)';
COMMENT ON COLUMN project_initialization_steps.display_name IS 'Human-readable step name for UI display';
COMMENT ON COLUMN project_initialization_steps.sequence IS 'Execution order of steps';
COMMENT ON COLUMN project_initialization_steps.status IS 'Step status: pending, running, completed, failed, skipped';
COMMENT ON COLUMN project_initialization_steps.progress IS 'Step progress percentage (0-100)';
COMMENT ON COLUMN project_initialization_steps.duration IS 'Step duration in milliseconds';
COMMENT ON COLUMN project_initialization_steps.metadata IS 'Additional step metadata as JSONB (e.g., filesCount, repositoryUrl)';
