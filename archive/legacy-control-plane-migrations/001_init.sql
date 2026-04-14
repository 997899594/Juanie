-- Migration: 001_init
-- Description: Initial database schema for Juanie
-- Created: 2026-02-28

-- ============================================
-- Enums
-- ============================================

CREATE TYPE "gitProviderType" AS ENUM ('github', 'gitlab', 'gitlab-self-hosted');
CREATE TYPE "serviceType" AS ENUM ('web', 'worker', 'cron');
CREATE TYPE "databaseType" AS ENUM ('postgresql', 'mysql', 'redis', 'mongodb');
CREATE TYPE "databasePlan" AS ENUM ('starter', 'standard', 'premium');
CREATE TYPE "projectStatus" AS ENUM ('initializing', 'active', 'failed', 'archived');
CREATE TYPE "deploymentStatus" AS ENUM ('queued', 'building', 'deploying', 'running', 'failed', 'rolled_back');
CREATE TYPE "initStepStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TYPE "teamRole" AS ENUM ('owner', 'admin', 'member');

-- ============================================
-- Auth Tables (NextAuth)
-- ============================================

CREATE TABLE IF NOT EXISTS "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text,
  "email" text NOT NULL UNIQUE,
  "emailVerified" timestamp,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text NOT NULL UNIQUE,
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "expires" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL
);

-- ============================================
-- Git Provider Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "gitProvider" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" "gitProviderType" NOT NULL,
  "name" varchar(255) NOT NULL,
  "serverUrl" varchar(500),
  "clientId" varchar(255),
  "clientSecret" varchar(255),
  "accessToken" text,
  "refreshToken" text,
  "tokenExpiresAt" timestamp,
  "externalUserId" varchar(255),
  "username" varchar(255),
  "avatarUrl" varchar(500),
  "isActive" boolean DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "repository" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" uuid NOT NULL REFERENCES "gitProvider"("id") ON DELETE CASCADE,
  "externalId" varchar(255) NOT NULL,
  "fullName" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "owner" varchar(255) NOT NULL,
  "cloneUrl" varchar(500),
  "sshUrl" varchar(500),
  "webUrl" varchar(500),
  "defaultBranch" varchar(100) DEFAULT 'main',
  "isPrivate" boolean DEFAULT false,
  "lastSyncAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT "repository_provider_external_unique" UNIQUE ("providerId", "externalId")
);

-- ============================================
-- Team Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "team" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "teamMember" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" "teamRole" NOT NULL DEFAULT 'member',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "teamInvitation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "role" "teamRole" NOT NULL DEFAULT 'member',
  "token" varchar(255) NOT NULL UNIQUE,
  "expires" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Project Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "repositoryId" uuid REFERENCES "repository"("id"),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description" text,
  "framework" varchar(100),
  "productionBranch" varchar(100) DEFAULT 'main',
  "autoDeploy" boolean DEFAULT true,
  "configJson" jsonb,
  "configUpdatedAt" timestamp,
  "status" "projectStatus" DEFAULT 'initializing',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "projectInitStep" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "step" varchar(100) NOT NULL,
  "status" "initStepStatus" NOT NULL DEFAULT 'pending',
  "message" text,
  "progress" integer DEFAULT 0,
  "error" text,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Service Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "service" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "type" "serviceType" NOT NULL,
  "buildCommand" varchar(500),
  "dockerfile" text,
  "dockerContext" varchar(255),
  "startCommand" varchar(500),
  "port" integer,
  "replicas" integer DEFAULT 1,
  "healthcheckPath" varchar(255),
  "healthcheckInterval" integer DEFAULT 30,
  "cronSchedule" varchar(100),
  "cpuRequest" varchar(50) DEFAULT '100m',
  "cpuLimit" varchar(50) DEFAULT '500m',
  "memoryRequest" varchar(50) DEFAULT '128Mi',
  "memoryLimit" varchar(50) DEFAULT '256Mi',
  "autoscaling" jsonb,
  "isPublic" boolean DEFAULT true,
  "internalDomain" varchar(255),
  "status" varchar(50) DEFAULT 'pending',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Environment Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "environment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "branch" varchar(100),
  "isPreview" boolean DEFAULT false,
  "previewPrNumber" integer,
  "namespace" varchar(100),
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Database Tables (Managed Databases)
-- ============================================

CREATE TABLE IF NOT EXISTS "database" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "type" "databaseType" NOT NULL,
  "plan" "databasePlan" NOT NULL DEFAULT 'starter',
  "connectionString" text,
  "host" varchar(255),
  "port" integer,
  "databaseName" varchar(255),
  "username" varchar(255),
  "password" varchar(255),
  "namespace" varchar(100),
  "serviceName" varchar(255),
  "status" varchar(50) DEFAULT 'pending',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Domain Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "domain" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid REFERENCES "environment"("id") ON DELETE SET NULL,
  "serviceId" uuid REFERENCES "service"("id") ON DELETE SET NULL,
  "hostname" varchar(255) NOT NULL,
  "isCustom" boolean DEFAULT false,
  "isVerified" boolean DEFAULT false,
  "verificationCode" varchar(100),
  "tlsEnabled" boolean DEFAULT true,
  "tlsCertArn" varchar(255),
  "lbIpAddress" varchar(50),
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Environment Variables
-- ============================================

CREATE TABLE IF NOT EXISTS "environmentVariable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid REFERENCES "environment"("id") ON DELETE CASCADE,
  "serviceId" uuid REFERENCES "service"("id") ON DELETE CASCADE,
  "key" varchar(255) NOT NULL,
  "value" text,
  "isSecret" boolean DEFAULT false,
  "encryptedValue" text,
  "iv" varchar(64),
  "authTag" varchar(64),
  "referenceType" varchar(50),
  "referenceId" uuid,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Deployment Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "deployment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "serviceId" uuid REFERENCES "service"("id") ON DELETE SET NULL,
  "version" varchar(100),
  "status" "deploymentStatus" NOT NULL DEFAULT 'queued',
  "commitSha" varchar(100),
  "commitMessage" text,
  "branch" varchar(100),
  "imageUrl" varchar(500),
  "buildLogs" text,
  "deployedById" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "deployedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Webhook Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "webhook" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "url" varchar(500) NOT NULL,
  "events" text[] NOT NULL,
  "secret" varchar(255),
  "active" boolean DEFAULT true,
  "lastTriggeredAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Project Templates
-- ============================================

CREATE TABLE IF NOT EXISTS "projectTemplate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL UNIQUE,
  "displayName" varchar(255) NOT NULL,
  "description" text,
  "framework" varchar(100),
  "language" varchar(50),
  "dockerfile" text NOT NULL,
  "configYaml" text NOT NULL,
  "files" jsonb,
  "isOfficial" boolean DEFAULT true,
  "sortOrder" integer DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Audit Logs
-- ============================================

CREATE TABLE IF NOT EXISTS "auditLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "userId" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "action" varchar(100) NOT NULL,
  "resourceType" varchar(100) NOT NULL,
  "resourceId" uuid,
  "metadata" jsonb,
  "ipAddress" varchar(50),
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS "gitProvider_userId_idx" ON "gitProvider"("userId");
CREATE INDEX IF NOT EXISTS "gitProvider_type_idx" ON "gitProvider"("type");
CREATE INDEX IF NOT EXISTS "repository_providerId_idx" ON "repository"("providerId");
CREATE INDEX IF NOT EXISTS "repository_fullName_idx" ON "repository"("fullName");
CREATE INDEX IF NOT EXISTS "teamMember_teamId_idx" ON "teamMember"("teamId");
CREATE INDEX IF NOT EXISTS "teamMember_userId_idx" ON "teamMember"("userId");
CREATE INDEX IF NOT EXISTS "project_teamId_idx" ON "project"("teamId");
CREATE INDEX IF NOT EXISTS "project_slug_idx" ON "project"("slug");
CREATE INDEX IF NOT EXISTS "project_status_idx" ON "project"("status");
CREATE INDEX IF NOT EXISTS "projectInitStep_projectId_idx" ON "projectInitStep"("projectId");
CREATE INDEX IF NOT EXISTS "service_projectId_idx" ON "service"("projectId");
CREATE INDEX IF NOT EXISTS "environment_projectId_idx" ON "environment"("projectId");
CREATE INDEX IF NOT EXISTS "database_projectId_idx" ON "database"("projectId");
CREATE INDEX IF NOT EXISTS "domain_projectId_idx" ON "domain"("projectId");
CREATE INDEX IF NOT EXISTS "domain_hostname_idx" ON "domain"("hostname");
CREATE INDEX IF NOT EXISTS "environmentVariable_projectId_idx" ON "environmentVariable"("projectId");
CREATE INDEX IF NOT EXISTS "deployment_projectId_idx" ON "deployment"("projectId");
CREATE INDEX IF NOT EXISTS "deployment_status_idx" ON "deployment"("status");
CREATE INDEX IF NOT EXISTS "auditLog_teamId_idx" ON "auditLog"("teamId");
CREATE INDEX IF NOT EXISTS "auditLog_createdAt_idx" ON "auditLog"("createdAt");
