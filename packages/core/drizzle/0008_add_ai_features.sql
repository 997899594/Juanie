-- Migration: Add AI module features
-- Created: 2024-12-09
-- Purpose: Add tables for AI prompt templates, conversations, and usage tracking

-- ==================== Prompt Templates Table ====================

CREATE TABLE IF NOT EXISTS "prompt_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "template" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "usage_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for prompt templates
CREATE INDEX IF NOT EXISTS "prompt_templates_org_idx" ON "prompt_templates"("organization_id");
CREATE INDEX IF NOT EXISTS "prompt_templates_category_idx" ON "prompt_templates"("category");
CREATE INDEX IF NOT EXISTS "prompt_templates_usage_idx" ON "prompt_templates"("usage_count");

-- ==================== AI Conversations Table ====================

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "title" text,
  "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for AI conversations
CREATE INDEX IF NOT EXISTS "ai_conversations_user_idx" ON "ai_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_project_idx" ON "ai_conversations"("project_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_created_idx" ON "ai_conversations"("created_at");

-- ==================== AI Usage Table ====================

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_tokens" integer NOT NULL,
  "completion_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "cost" integer NOT NULL,
  "cached" boolean NOT NULL DEFAULT false,
  "timestamp" timestamp NOT NULL DEFAULT now()
);

-- Indexes for AI usage
CREATE INDEX IF NOT EXISTS "ai_usage_user_idx" ON "ai_usage"("user_id");
CREATE INDEX IF NOT EXISTS "ai_usage_project_idx" ON "ai_usage"("project_id");
CREATE INDEX IF NOT EXISTS "ai_usage_timestamp_idx" ON "ai_usage"("timestamp");
CREATE INDEX IF NOT EXISTS "ai_usage_provider_model_idx" ON "ai_usage"("provider", "model");
