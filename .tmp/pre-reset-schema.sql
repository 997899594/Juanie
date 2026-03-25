--
-- PostgreSQL database dump
--

\restrict tUfLdClHumJEpcmKj1WnLbwGNEDuEXWl05rJMaRYSy3EcK7Bz9L9C8e1iXkPTpf

-- Dumped from database version 17.7 (Homebrew)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: findbiao
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO findbiao;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: findbiao
--

COMMENT ON SCHEMA public IS '';


--
-- Name: databasePlan; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."databasePlan" AS ENUM (
    'starter',
    'standard',
    'premium'
);


ALTER TYPE public."databasePlan" OWNER TO findbiao;

--
-- Name: databaseType; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."databaseType" AS ENUM (
    'postgresql',
    'mysql',
    'redis',
    'mongodb'
);


ALTER TYPE public."databaseType" OWNER TO findbiao;

--
-- Name: deploymentStatus; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."deploymentStatus" AS ENUM (
    'queued',
    'building',
    'deploying',
    'running',
    'failed',
    'rolled_back'
);


ALTER TYPE public."deploymentStatus" OWNER TO findbiao;

--
-- Name: gitProviderType; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."gitProviderType" AS ENUM (
    'github',
    'gitlab',
    'gitlab-self-hosted'
);


ALTER TYPE public."gitProviderType" OWNER TO findbiao;

--
-- Name: initStepStatus; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."initStepStatus" AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped'
);


ALTER TYPE public."initStepStatus" OWNER TO findbiao;

--
-- Name: integrationCapability; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."integrationCapability" AS ENUM (
    'read_repo',
    'write_repo',
    'write_workflow',
    'manage_webhook'
);


ALTER TYPE public."integrationCapability" OWNER TO findbiao;

--
-- Name: projectStatus; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."projectStatus" AS ENUM (
    'initializing',
    'active',
    'failed',
    'archived'
);


ALTER TYPE public."projectStatus" OWNER TO findbiao;

--
-- Name: serviceType; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."serviceType" AS ENUM (
    'web',
    'worker',
    'cron'
);


ALTER TYPE public."serviceType" OWNER TO findbiao;

--
-- Name: teamRole; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."teamRole" AS ENUM (
    'owner',
    'admin',
    'member'
);


ALTER TYPE public."teamRole" OWNER TO findbiao;

--
-- Name: webhookType; Type: TYPE; Schema: public; Owner: findbiao
--

CREATE TYPE public."webhookType" AS ENUM (
    'git-push',
    'registry'
);


ALTER TYPE public."webhookType" OWNER TO findbiao;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public.account OWNER TO findbiao;

--
-- Name: auditLog; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."auditLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid,
    action character varying(100) NOT NULL,
    "resourceType" character varying(100) NOT NULL,
    "resourceId" uuid,
    metadata jsonb,
    "ipAddress" character varying(50),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."auditLog" OWNER TO findbiao;

--
-- Name: database; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.database (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    type public."databaseType" NOT NULL,
    plan public."databasePlan" DEFAULT 'starter'::public."databasePlan" NOT NULL,
    "connectionString" text,
    host character varying(255),
    port integer,
    "databaseName" character varying(255),
    username character varying(255),
    password character varying(255),
    namespace character varying(100),
    "serviceName" character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.database OWNER TO findbiao;

--
-- Name: databaseMigration; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."databaseMigration" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "databaseId" uuid NOT NULL,
    filename character varying(255) NOT NULL,
    checksum character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    output text,
    error text,
    "executedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."databaseMigration" OWNER TO findbiao;

--
-- Name: deployment; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.deployment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "environmentId" uuid NOT NULL,
    "serviceId" uuid,
    version character varying(100),
    status public."deploymentStatus" DEFAULT 'queued'::public."deploymentStatus" NOT NULL,
    "commitSha" character varying(100),
    "commitMessage" text,
    branch character varying(100),
    "imageUrl" character varying(500),
    "buildLogs" text,
    "deployedById" uuid,
    "deployedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deployment OWNER TO findbiao;

--
-- Name: deploymentLog; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."deploymentLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "deploymentId" uuid NOT NULL,
    level character varying(10) DEFAULT 'info'::character varying NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."deploymentLog" OWNER TO findbiao;

--
-- Name: domain; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.domain (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "environmentId" uuid,
    "serviceId" uuid,
    hostname character varying(255) NOT NULL,
    "isCustom" boolean DEFAULT false,
    "isVerified" boolean DEFAULT false,
    "verificationCode" character varying(100),
    "tlsEnabled" boolean DEFAULT true,
    "tlsCertArn" character varying(255),
    "lbIpAddress" character varying(50),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domain OWNER TO findbiao;

--
-- Name: environment; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.environment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    name character varying(100) NOT NULL,
    branch character varying(100),
    "isPreview" boolean DEFAULT false,
    "previewPrNumber" integer,
    namespace character varying(100),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.environment OWNER TO findbiao;

--
-- Name: environmentVariable; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."environmentVariable" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    "environmentId" uuid,
    "serviceId" uuid,
    key character varying(255) NOT NULL,
    value text,
    "isSecret" boolean DEFAULT false,
    "referenceType" character varying(50),
    "referenceId" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "encryptedValue" text,
    iv character varying(64),
    "authTag" character varying(64),
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."environmentVariable" OWNER TO findbiao;

--
-- Name: gitProvider; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."gitProvider" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    type public."gitProviderType" NOT NULL,
    name character varying(255) NOT NULL,
    "serverUrl" character varying(500),
    "clientId" character varying(255),
    "clientSecret" character varying(255),
    "accessToken" text,
    "refreshToken" text,
    "tokenExpiresAt" timestamp without time zone,
    "externalUserId" character varying(255),
    username character varying(255),
    "avatarUrl" character varying(500),
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."gitProvider" OWNER TO findbiao;

--
-- Name: integration_capability_snapshot; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.integration_capability_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "integrationGrantId" uuid NOT NULL,
    capability public."integrationCapability" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_capability_snapshot OWNER TO findbiao;

--
-- Name: integration_grant; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.integration_grant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "integrationIdentityId" uuid NOT NULL,
    "accessToken" text NOT NULL,
    "refreshToken" text,
    "scopeRaw" text,
    "expiresAt" timestamp without time zone,
    "revokedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_grant OWNER TO findbiao;

--
-- Name: integration_identity; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.integration_identity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    provider public."gitProviderType" NOT NULL,
    "externalUserId" character varying(255),
    username character varying(255),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.integration_identity OWNER TO findbiao;

--
-- Name: project; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "teamId" uuid NOT NULL,
    "repositoryId" uuid,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    framework character varying(100),
    "productionBranch" character varying(100) DEFAULT 'main'::character varying,
    "autoDeploy" boolean DEFAULT true,
    "configJson" jsonb,
    "configUpdatedAt" timestamp without time zone,
    status public."projectStatus" DEFAULT 'initializing'::public."projectStatus",
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project OWNER TO findbiao;

--
-- Name: projectInitStep; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."projectInitStep" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    step character varying(100) NOT NULL,
    status public."initStepStatus" DEFAULT 'pending'::public."initStepStatus" NOT NULL,
    message text,
    progress integer DEFAULT 0,
    error text,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."projectInitStep" OWNER TO findbiao;

--
-- Name: projectTemplate; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."projectTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    "displayName" character varying(255) NOT NULL,
    description text,
    framework character varying(100),
    language character varying(50),
    dockerfile text NOT NULL,
    "configYaml" text NOT NULL,
    files jsonb,
    "isOfficial" boolean DEFAULT true,
    "sortOrder" integer DEFAULT 0,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."projectTemplate" OWNER TO findbiao;

--
-- Name: repository; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.repository (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "providerId" uuid NOT NULL,
    "externalId" character varying(255) NOT NULL,
    "fullName" character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    "cloneUrl" character varying(500),
    "sshUrl" character varying(500),
    "webUrl" character varying(500),
    "defaultBranch" character varying(100) DEFAULT 'main'::character varying,
    "isPrivate" boolean DEFAULT false,
    "lastSyncAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.repository OWNER TO findbiao;

--
-- Name: service; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.service (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    type public."serviceType" NOT NULL,
    "buildCommand" character varying(500),
    dockerfile text,
    "dockerContext" character varying(255),
    "startCommand" character varying(500),
    port integer,
    replicas integer DEFAULT 1,
    "healthcheckPath" character varying(255),
    "healthcheckInterval" integer DEFAULT 30,
    "cronSchedule" character varying(100),
    "cpuRequest" character varying(50) DEFAULT '100m'::character varying,
    "cpuLimit" character varying(50) DEFAULT '500m'::character varying,
    "memoryRequest" character varying(50) DEFAULT '128Mi'::character varying,
    "memoryLimit" character varying(50) DEFAULT '256Mi'::character varying,
    autoscaling jsonb,
    "isPublic" boolean DEFAULT true,
    "internalDomain" character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service OWNER TO findbiao;

--
-- Name: session; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid NOT NULL,
    expires timestamp without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO findbiao;

--
-- Name: team; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.team OWNER TO findbiao;

--
-- Name: teamInvitation; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."teamInvitation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "teamId" uuid NOT NULL,
    email character varying(255),
    role public."teamRole" DEFAULT 'member'::public."teamRole" NOT NULL,
    token character varying(255) NOT NULL,
    expires timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."teamInvitation" OWNER TO findbiao;

--
-- Name: teamMember; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."teamMember" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public."teamRole" DEFAULT 'member'::public."teamRole" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."teamMember" OWNER TO findbiao;

--
-- Name: user; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    email text NOT NULL,
    "emailVerified" timestamp without time zone,
    image text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."user" OWNER TO findbiao;

--
-- Name: verificationToken; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public."verificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp without time zone NOT NULL
);


ALTER TABLE public."verificationToken" OWNER TO findbiao;

--
-- Name: webhook; Type: TABLE; Schema: public; Owner: findbiao
--

CREATE TABLE public.webhook (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "projectId" uuid NOT NULL,
    url character varying(500) NOT NULL,
    events text[] NOT NULL,
    secret character varying(255),
    active boolean DEFAULT true,
    "lastTriggeredAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "externalId" character varying(255),
    type character varying(50) DEFAULT 'git-push'::character varying
);


ALTER TABLE public.webhook OWNER TO findbiao;

--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: auditLog auditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."auditLog"
    ADD CONSTRAINT "auditLog_pkey" PRIMARY KEY (id);


--
-- Name: databaseMigration databaseMigration_databaseId_filename_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."databaseMigration"
    ADD CONSTRAINT "databaseMigration_databaseId_filename_unique" UNIQUE ("databaseId", filename);


--
-- Name: databaseMigration databaseMigration_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."databaseMigration"
    ADD CONSTRAINT "databaseMigration_pkey" PRIMARY KEY (id);


--
-- Name: database database_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.database
    ADD CONSTRAINT database_pkey PRIMARY KEY (id);


--
-- Name: deploymentLog deploymentLog_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."deploymentLog"
    ADD CONSTRAINT "deploymentLog_pkey" PRIMARY KEY (id);


--
-- Name: deployment deployment_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT deployment_pkey PRIMARY KEY (id);


--
-- Name: domain domain_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.domain
    ADD CONSTRAINT domain_pkey PRIMARY KEY (id);


--
-- Name: environmentVariable environmentVariable_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."environmentVariable"
    ADD CONSTRAINT "environmentVariable_pkey" PRIMARY KEY (id);


--
-- Name: environment environment_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.environment
    ADD CONSTRAINT environment_pkey PRIMARY KEY (id);


--
-- Name: gitProvider gitProvider_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."gitProvider"
    ADD CONSTRAINT "gitProvider_pkey" PRIMARY KEY (id);


--
-- Name: integration_capability_snapshot integration_capability_snapshot_grant_capability_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.integration_capability_snapshot
    ADD CONSTRAINT integration_capability_snapshot_grant_capability_unique UNIQUE ("integrationGrantId", capability);


--
-- Name: integration_capability_snapshot integration_capability_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.integration_capability_snapshot
    ADD CONSTRAINT integration_capability_snapshot_pkey PRIMARY KEY (id);


--
-- Name: integration_grant integration_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.integration_grant
    ADD CONSTRAINT integration_grant_pkey PRIMARY KEY (id);


--
-- Name: integration_identity integration_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.integration_identity
    ADD CONSTRAINT integration_identity_pkey PRIMARY KEY (id);


--
-- Name: projectInitStep projectInitStep_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."projectInitStep"
    ADD CONSTRAINT "projectInitStep_pkey" PRIMARY KEY (id);


--
-- Name: projectTemplate projectTemplate_name_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."projectTemplate"
    ADD CONSTRAINT "projectTemplate_name_unique" UNIQUE (name);


--
-- Name: projectTemplate projectTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."projectTemplate"
    ADD CONSTRAINT "projectTemplate_pkey" PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: repository repository_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.repository
    ADD CONSTRAINT repository_pkey PRIMARY KEY (id);


--
-- Name: repository repository_provider_external_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.repository
    ADD CONSTRAINT repository_provider_external_unique UNIQUE ("providerId", "externalId");


--
-- Name: service service_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT service_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_sessionToken_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_sessionToken_unique" UNIQUE ("sessionToken");


--
-- Name: teamInvitation teamInvitation_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamInvitation"
    ADD CONSTRAINT "teamInvitation_pkey" PRIMARY KEY (id);


--
-- Name: teamInvitation teamInvitation_token_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamInvitation"
    ADD CONSTRAINT "teamInvitation_token_unique" UNIQUE (token);


--
-- Name: teamMember teamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_pkey" PRIMARY KEY (id);


--
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- Name: team team_slug_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_slug_unique UNIQUE (slug);


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: webhook webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.webhook
    ADD CONSTRAINT webhook_pkey PRIMARY KEY (id);


--
-- Name: auditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "auditLog_createdAt_idx" ON public."auditLog" USING btree ("createdAt");


--
-- Name: auditLog_teamId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "auditLog_teamId_idx" ON public."auditLog" USING btree ("teamId");


--
-- Name: databaseMigration_databaseId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "databaseMigration_databaseId_idx" ON public."databaseMigration" USING btree ("databaseId");


--
-- Name: database_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "database_projectId_idx" ON public.database USING btree ("projectId");


--
-- Name: deploymentLog_deploymentId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "deploymentLog_deploymentId_idx" ON public."deploymentLog" USING btree ("deploymentId");


--
-- Name: deployment_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "deployment_projectId_idx" ON public.deployment USING btree ("projectId");


--
-- Name: deployment_status_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX deployment_status_idx ON public.deployment USING btree (status);


--
-- Name: domain_hostname_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX domain_hostname_idx ON public.domain USING btree (hostname);


--
-- Name: domain_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "domain_projectId_idx" ON public.domain USING btree ("projectId");


--
-- Name: environmentVariable_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "environmentVariable_projectId_idx" ON public."environmentVariable" USING btree ("projectId");


--
-- Name: environment_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "environment_projectId_idx" ON public.environment USING btree ("projectId");


--
-- Name: gitProvider_type_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "gitProvider_type_idx" ON public."gitProvider" USING btree (type);


--
-- Name: gitProvider_userId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "gitProvider_userId_idx" ON public."gitProvider" USING btree ("userId");


--
-- Name: projectInitStep_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "projectInitStep_projectId_idx" ON public."projectInitStep" USING btree ("projectId");


--
-- Name: project_slug_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX project_slug_idx ON public.project USING btree (slug);


--
-- Name: project_status_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX project_status_idx ON public.project USING btree (status);


--
-- Name: project_teamId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "project_teamId_idx" ON public.project USING btree ("teamId");


--
-- Name: repository_fullName_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "repository_fullName_idx" ON public.repository USING btree ("fullName");


--
-- Name: repository_providerId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "repository_providerId_idx" ON public.repository USING btree ("providerId");


--
-- Name: service_projectId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "service_projectId_idx" ON public.service USING btree ("projectId");


--
-- Name: teamMember_teamId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "teamMember_teamId_idx" ON public."teamMember" USING btree ("teamId");


--
-- Name: teamMember_userId_idx; Type: INDEX; Schema: public; Owner: findbiao
--

CREATE INDEX "teamMember_userId_idx" ON public."teamMember" USING btree ("userId");


--
-- Name: account account_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: auditLog auditLog_teamId_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."auditLog"
    ADD CONSTRAINT "auditLog_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: auditLog auditLog_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."auditLog"
    ADD CONSTRAINT "auditLog_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: database database_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.database
    ADD CONSTRAINT "database_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: deployment deployment_deployedById_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_deployedById_user_id_fk" FOREIGN KEY ("deployedById") REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: deployment deployment_environmentId_environment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES public.environment(id) ON DELETE CASCADE;


--
-- Name: deployment deployment_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: deployment deployment_serviceId_service_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.deployment
    ADD CONSTRAINT "deployment_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES public.service(id) ON DELETE SET NULL;


--
-- Name: domain domain_environmentId_environment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.domain
    ADD CONSTRAINT "domain_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES public.environment(id) ON DELETE SET NULL;


--
-- Name: domain domain_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.domain
    ADD CONSTRAINT "domain_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: domain domain_serviceId_service_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.domain
    ADD CONSTRAINT "domain_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES public.service(id) ON DELETE SET NULL;


--
-- Name: environmentVariable environmentVariable_environmentId_environment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."environmentVariable"
    ADD CONSTRAINT "environmentVariable_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES public.environment(id) ON DELETE CASCADE;


--
-- Name: environmentVariable environmentVariable_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."environmentVariable"
    ADD CONSTRAINT "environmentVariable_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: environmentVariable environmentVariable_serviceId_service_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."environmentVariable"
    ADD CONSTRAINT "environmentVariable_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES public.service(id) ON DELETE CASCADE;


--
-- Name: environment environment_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.environment
    ADD CONSTRAINT "environment_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: gitProvider gitProvider_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."gitProvider"
    ADD CONSTRAINT "gitProvider_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: projectInitStep projectInitStep_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."projectInitStep"
    ADD CONSTRAINT "projectInitStep_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project project_repositoryId_repository_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "project_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES public.repository(id);


--
-- Name: project project_teamId_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "project_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: service service_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT "service_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: session session_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: teamInvitation teamInvitation_teamId_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamInvitation"
    ADD CONSTRAINT "teamInvitation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: teamMember teamMember_teamId_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: teamMember teamMember_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public."teamMember"
    ADD CONSTRAINT "teamMember_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: webhook webhook_projectId_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: findbiao
--

ALTER TABLE ONLY public.webhook
    ADD CONSTRAINT "webhook_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: findbiao
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict tUfLdClHumJEpcmKj1WnLbwGNEDuEXWl05rJMaRYSy3EcK7Bz9L9C8e1iXkPTpf

