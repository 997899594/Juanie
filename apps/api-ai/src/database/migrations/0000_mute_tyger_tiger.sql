CREATE TYPE "public"."assistant_type" AS ENUM('code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder');--> statement-breakpoint
CREATE TYPE "public"."model_provider" AS ENUM('openai', 'anthropic', 'google', 'custom');--> statement-breakpoint
CREATE TYPE "public"."recommendation_context_type" AS ENUM('code', 'security', 'performance', 'cost');--> statement-breakpoint
CREATE TYPE "public"."recommendation_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."user_feedback" AS ENUM('accepted', 'rejected', 'modified');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'service');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure', 'denied');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."analyzer_type" AS ENUM('security', 'quality', 'performance', 'ai_review');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'running', 'success', 'failed', 'cancelled', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."deployment_strategy" AS ENUM('rolling', 'blue_green', 'canary', 'recreate', 'a_b_testing');--> statement-breakpoint
CREATE TYPE "public"."rollback_strategy" AS ENUM('automatic', 'manual', 'conditional');--> statement-breakpoint
CREATE TYPE "public"."cloud_provider" AS ENUM('aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."environment_status" AS ENUM('active', 'inactive', 'provisioning', 'error', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."environment_type" AS ENUM('development', 'staging', 'production', 'testing', 'preview');--> statement-breakpoint
CREATE TYPE "public"."event_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('created', 'queued', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."identity_provider_type" AS ENUM('github', 'gitlab', 'oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."incident_category" AS ENUM('infrastructure', 'application', 'security', 'performance');--> statement-breakpoint
CREATE TYPE "public"."incident_priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('anomaly', 'threshold', 'prediction', 'correlation');--> statement-breakpoint
CREATE TYPE "public"."impact_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."root_cause_category" AS ENUM('performance', 'availability', 'security', 'capacity', 'configuration');--> statement-breakpoint
CREATE TYPE "public"."metric_category" AS ENUM('performance', 'availability', 'error', 'capacity');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('counter', 'gauge', 'histogram', 'summary');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'inactive', 'archived', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."project_visibility" AS ENUM('public', 'private', 'internal');--> statement-breakpoint
CREATE TYPE "public"."repository_provider" AS ENUM('github', 'gitlab', 'bitbucket');--> statement-breakpoint
CREATE TYPE "public"."repository_sync_status" AS ENUM('pending', 'syncing', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."config_source" AS ENUM('repository', 'ui', 'api', 'template');--> statement-breakpoint
CREATE TYPE "public"."pipeline_run_status" AS ENUM('pending', 'running', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pipeline_run_trigger_type" AS ENUM('push', 'pull_request', 'schedule', 'manual');--> statement-breakpoint
CREATE TYPE "public"."monitor_type" AS ENUM('uptime', 'performance', 'error_rate', 'custom');--> statement-breakpoint
CREATE TYPE "public"."security_policy_status" AS ENUM('active', 'inactive', 'draft');--> statement-breakpoint
CREATE TYPE "public"."security_policy_type" AS ENUM('access-control', 'network', 'data-protection', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."remediation_status" AS ENUM('pending', 'in_progress', 'completed', 'false_positive', 'accepted_risk');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('sast', 'dast', 'dependency', 'container', 'infrastructure');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('code', 'container', 'deployment', 'infrastructure');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('global', 'organization', 'team', 'project');--> statement-breakpoint
CREATE TYPE "public"."team_membership_role" AS ENUM('member', 'maintainer', 'owner');--> statement-breakpoint
CREATE TYPE "public"."team_membership_status" AS ENUM('active', 'pending', 'removed');--> statement-breakpoint
CREATE TYPE "public"."project_member_role" AS ENUM('guest', 'reporter', 'developer', 'maintainer', 'owner');--> statement-breakpoint
CREATE TYPE "public"."project_member_status" AS ENUM('active', 'pending', 'removed');--> statement-breakpoint
CREATE TYPE "public"."role_assignment_scope" AS ENUM('global', 'organization', 'team', 'project');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('github', 'gitlab', 'oidc', 'saml');--> statement-breakpoint
CREATE TABLE "ai_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"avatar" text,
	"type" "assistant_type" NOT NULL,
	"specialization" varchar(100),
	"model_type" varchar(50) NOT NULL,
	"model_config" jsonb NOT NULL,
	"system_prompt" text NOT NULL,
	"capabilities" text[] DEFAULT '{}' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"average_rating" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid,
	"context_type" "recommendation_context_type" NOT NULL,
	"context_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"recommendation_type" text NOT NULL,
	"recommendation_details" text,
	"implementation_steps" text,
	"confidence_score" numeric(3, 2) NOT NULL,
	"priority" "recommendation_priority" DEFAULT 'medium',
	"user_feedback" "user_feedback",
	"feedback_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"user_id" uuid,
	"actor_type" "audit_actor_type" DEFAULT 'user' NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"request_id" text,
	"correlation_id" text,
	"ip_address" text,
	"user_agent" text,
	"outcome" "audit_outcome" DEFAULT 'success' NOT NULL,
	"severity" "audit_severity" DEFAULT 'low' NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"session_token_hash" text NOT NULL,
	"refresh_token_hash" text,
	"access_expires_at" timestamp,
	"refresh_expires_at" timestamp,
	"last_used_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid,
	"commit_hash" text NOT NULL,
	"branch" text,
	"analyzer_type" "analyzer_type" NOT NULL,
	"analyzer_version" text,
	"overall_score" numeric(3, 2),
	"issues_found" integer DEFAULT 0,
	"critical_issues" integer DEFAULT 0,
	"security_vulnerabilities" integer DEFAULT 0,
	"top_finding_category" text,
	"finding_count" integer DEFAULT 0,
	"finding_severity" text,
	"suggestion_count" integer DEFAULT 0,
	"top_suggestion" text,
	"ai_summary" text,
	"ai_recommendation_count" integer DEFAULT 0,
	"top_ai_recommendation" text,
	"ai_confidence_score" numeric(3, 2),
	"score_trend" text,
	"trend_percentage" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"organization_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"compute_cost" numeric(10, 2) DEFAULT '0',
	"storage_cost" numeric(10, 2) DEFAULT '0',
	"network_cost" numeric(10, 2) DEFAULT '0',
	"database_cost" numeric(10, 2) DEFAULT '0',
	"monitoring_cost" numeric(10, 2) DEFAULT '0',
	"optimization_tips" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"pipeline_run_id" uuid,
	"version" text NOT NULL,
	"commit_hash" text NOT NULL,
	"commit_message" text,
	"branch" text NOT NULL,
	"deployment_strategy" "deployment_strategy" DEFAULT 'rolling',
	"rollback_strategy" "rollback_strategy" DEFAULT 'manual',
	"status" "deployment_status" DEFAULT 'pending',
	"started_at" timestamp,
	"finished_at" timestamp,
	"deployed_by" uuid,
	"approved_by" uuid,
	"success_probability" numeric(3, 2),
	"risk_level" text,
	"risk_score" integer,
	"risk_factors" text,
	"predicted_response_time" integer,
	"predicted_throughput" integer,
	"predicted_availability" numeric(5, 2),
	"avg_response_time" integer,
	"throughput_rps" integer,
	"availability" numeric(5, 2),
	"error_rate" numeric(5, 4),
	"response_time_p95" integer,
	"deployment_cost" numeric(10, 2),
	"cpu_usage_avg" numeric(5, 2),
	"memory_usage_avg" numeric(5, 2),
	"disk_usage_gb" numeric(8, 2),
	"carbon_footprint" numeric(8, 3),
	"rollback_reason" text,
	"rolled_back_at" timestamp,
	"rollback_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"description" text,
	"environment_type" "environment_type" NOT NULL,
	"cloud_provider" "cloud_provider",
	"region" text,
	"instance_type" text,
	"cluster_size" integer DEFAULT 1,
	"enable_auto_scaling" boolean DEFAULT false,
	"cpu_cores" integer DEFAULT 1,
	"memory_gb" integer DEFAULT 2,
	"storage_gb" integer DEFAULT 10,
	"vpc_id" text,
	"subnet_id" text,
	"security_group_id" text,
	"load_balancer_enabled" boolean DEFAULT false,
	"status" "environment_status" DEFAULT 'active',
	"health_check_url" text,
	"last_health_check" timestamp,
	"require_vpn" boolean DEFAULT false,
	"allowed_ips" text,
	"allowed_user_ids" text,
	"allowed_team_ids" text,
	"max_cpu_cores" integer DEFAULT 8,
	"max_memory_gb" integer DEFAULT 32,
	"max_storage_gb" integer DEFAULT 100,
	"cost_budget" numeric(10, 2),
	"min_instances" integer DEFAULT 1,
	"max_instances" integer DEFAULT 5,
	"target_cpu_utilization" integer DEFAULT 70,
	"compliance_frameworks" text,
	"encryption_enabled" boolean DEFAULT true,
	"backup_enabled" boolean DEFAULT true,
	"monitoring_enabled" boolean DEFAULT true,
	"data_classification" "data_classification" DEFAULT 'internal',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"event_type" text NOT NULL,
	"source" text,
	"priority" "event_priority" DEFAULT 'medium' NOT NULL,
	"status" "event_status" DEFAULT 'created' NOT NULL,
	"payload" jsonb NOT NULL,
	"trace_id" text,
	"span_id" text,
	"result" jsonb,
	"queued_at" timestamp,
	"processed_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"feature_flag_id" integer,
	"name" text NOT NULL,
	"hypothesis" text,
	"primary_success_metric" text,
	"secondary_success_metrics" text,
	"success_metric_target_value" numeric(5, 2),
	"traffic_allocation" numeric(5, 2) DEFAULT '50.0',
	"control_variant_name" text NOT NULL,
	"control_variant_description" text,
	"test_variant_count" integer DEFAULT 1,
	"test_variant_names" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"duration_days" integer,
	"minimum_sample_size" integer,
	"confidence_level" numeric(3, 2) DEFAULT '0.95',
	"statistical_power" numeric(3, 2) DEFAULT '0.80',
	"ai_analysis_enabled" boolean DEFAULT true,
	"real_time_monitoring" boolean DEFAULT true,
	"auto_stop_enabled" boolean DEFAULT false,
	"auto_stop_min_sample_size" integer,
	"auto_stop_confidence_level" numeric(3, 2),
	"auto_stop_max_duration" integer,
	"experiment_conclusion" text,
	"primary_metric_result" numeric(5, 2),
	"statistical_significance_achieved" boolean,
	"statistical_significance" boolean,
	"winner_variant" text,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_type" "identity_provider_type" NOT NULL,
	"name" text NOT NULL,
	"client_id" text,
	"client_secret" text,
	"issuer_url" text,
	"authorization_url" text,
	"token_url" text,
	"user_info_url" text,
	"redirect_uri" text,
	"scope" text,
	"settings" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"priority" "incident_priority" NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"category" "incident_category" NOT NULL,
	"subcategory" varchar(50),
	"impact_assessment" jsonb,
	"detection_response" jsonb,
	"technical_details" jsonb,
	"root_cause_analysis" jsonb,
	"resolution_mitigation" jsonb,
	"communication_updates" jsonb,
	"ai_assisted_response" jsonb,
	"metrics_sla" jsonb,
	"post_incident_review" jsonb,
	"project_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"assigned_to" uuid,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligent_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_config_id" uuid,
	"alert_type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"ai_confidence" numeric(3, 2) NOT NULL,
	"root_cause_category" "root_cause_category",
	"root_cause_component" text,
	"root_cause_description" text,
	"related_alerts_count" integer DEFAULT 0 NOT NULL,
	"correlation_strength" numeric(3, 2),
	"impact_level" "impact_level",
	"affected_services" text,
	"estimated_downtime" integer,
	"prediction_horizon" integer,
	"probability_score" numeric(3, 2),
	"auto_remediation_available" boolean DEFAULT false NOT NULL,
	"remediation_action_type" text,
	"remediation_script" text,
	"remediation_success_rate" numeric(3, 2),
	"auto_remediation_applied" boolean DEFAULT false NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"notification_channels" text,
	"notification_sent_count" integer DEFAULT 0 NOT NULL,
	"first_notification_sent_at" timestamp,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"environment_id" uuid,
	"service_name" text NOT NULL,
	"metric_name" text NOT NULL,
	"metric_type" "metric_type" NOT NULL,
	"metric_category" "metric_category" NOT NULL,
	"value" numeric(15, 6) NOT NULL,
	"unit" text,
	"simple_labels" text,
	"timestamp" timestamp NOT NULL,
	"is_alert" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text,
	"description" text,
	"repository_url" text,
	"visibility" "project_visibility" DEFAULT 'private',
	"status" "project_status" DEFAULT 'active',
	"default_branch" text DEFAULT 'main',
	"enable_ci_cd" boolean DEFAULT true,
	"enable_ai_assistant" boolean DEFAULT true,
	"enable_monitoring" boolean DEFAULT true,
	"ai_model_preference" text DEFAULT 'gpt-4',
	"ai_auto_review" boolean DEFAULT true,
	"ai_cost_optimization" boolean DEFAULT true,
	"max_compute_units" integer DEFAULT 100,
	"max_storage_gb" integer DEFAULT 100,
	"max_monthly_cost" numeric(10, 2) DEFAULT '1000.00',
	"current_compute_units" integer DEFAULT 0,
	"current_storage_gb" integer DEFAULT 0,
	"current_monthly_cost" numeric(10, 2) DEFAULT '0.00',
	"primary_tag" text,
	"secondary_tags" text,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"provider" "repository_provider" NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"clone_url" text NOT NULL,
	"web_url" text NOT NULL,
	"description" text,
	"default_branch" text DEFAULT 'main',
	"protected_branch_names" text,
	"main_branch_protected" boolean DEFAULT true,
	"require_approval_count" integer DEFAULT 1,
	"require_linear_history" boolean DEFAULT false,
	"allow_force_pushes" boolean DEFAULT false,
	"allow_deletions" boolean DEFAULT false,
	"is_private" boolean DEFAULT true,
	"is_archived" boolean DEFAULT false,
	"is_template" boolean DEFAULT false,
	"auto_merge_enabled" boolean DEFAULT false,
	"auto_delete_branches" boolean DEFAULT true,
	"require_code_review" boolean DEFAULT true,
	"require_status_checks" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_status" "repository_sync_status" DEFAULT 'pending',
	"sync_error" text,
	"stars_count" integer DEFAULT 0,
	"forks_count" integer DEFAULT 0,
	"issues_count" integer DEFAULT 0,
	"pull_requests_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"repository_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"config_source" "config_source" DEFAULT 'repository',
	"config_path" text DEFAULT '.github/workflows/ci.yml',
	"pipeline_timeout" integer DEFAULT 3600,
	"max_retries" integer DEFAULT 3,
	"enable_artifacts" boolean DEFAULT true,
	"trigger_on_push" boolean DEFAULT true,
	"trigger_on_pr" boolean DEFAULT true,
	"trigger_on_schedule" boolean DEFAULT false,
	"trigger_on_manual" boolean DEFAULT true,
	"main_branch" text DEFAULT 'main',
	"protected_branches" text DEFAULT 'main,develop',
	"include_paths" text DEFAULT '**/*',
	"exclude_paths" text DEFAULT 'node_modules/**,.git/**',
	"ai_optimization_enabled" boolean DEFAULT true,
	"auto_parallelization" boolean DEFAULT false,
	"smart_caching" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"success_rate" numeric(3, 2),
	"average_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid,
	"trigger_type" "pipeline_run_trigger_type" NOT NULL,
	"trigger_user_id" uuid,
	"trigger_source" text,
	"trigger_branch" text,
	"trigger_commit" text,
	"run_number" integer NOT NULL,
	"commit_hash" text,
	"branch" text,
	"status" "pipeline_run_status" DEFAULT 'pending',
	"started_at" timestamp,
	"finished_at" timestamp,
	"duration" integer,
	"compute_units_used" numeric(10, 2),
	"estimated_cost" numeric(10, 2),
	"carbon_footprint" numeric(10, 4),
	"failure_prediction_score" numeric(3, 2),
	"optimization_suggestion" text,
	"performance_score" integer,
	"tests_total" integer DEFAULT 0,
	"tests_passed" integer DEFAULT 0,
	"tests_failed" integer DEFAULT 0,
	"test_coverage" numeric(5, 2),
	"vulnerabilities_critical" integer DEFAULT 0,
	"vulnerabilities_high" integer DEFAULT 0,
	"vulnerabilities_medium" integer DEFAULT 0,
	"vulnerabilities_low" integer DEFAULT 0,
	"security_score" integer,
	"artifact_count" integer DEFAULT 0,
	"artifact_size_mb" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"environment_id" uuid,
	"service_name" text,
	"monitor_type" "monitor_type" NOT NULL,
	"check_interval" integer DEFAULT 60,
	"timeout" integer DEFAULT 30,
	"retry_count" integer DEFAULT 3,
	"check_url" text,
	"check_method" text DEFAULT 'GET',
	"check_headers" text,
	"check_body" text,
	"expected_status_code" integer DEFAULT 200,
	"expected_response_contains" text,
	"ai_anomaly_detection" boolean DEFAULT true,
	"baseline_learning_enabled" boolean DEFAULT true,
	"auto_threshold_adjustment" boolean DEFAULT true,
	"warning_response_time" integer DEFAULT 2000,
	"warning_error_rate" numeric(5, 2) DEFAULT '5.00',
	"critical_response_time" integer DEFAULT 5000,
	"critical_error_rate" numeric(5, 2) DEFAULT '10.00',
	"email_notifications" boolean DEFAULT true,
	"slack_notifications" boolean DEFAULT false,
	"sms_notifications" boolean DEFAULT false,
	"escalation_enabled" boolean DEFAULT false,
	"escalation_after_minutes" integer DEFAULT 30,
	"escalation_email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"environment_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"policy_type" "security_policy_type" NOT NULL,
	"status" "security_policy_status" DEFAULT 'draft' NOT NULL,
	"rules" text,
	"is_enforced" boolean DEFAULT false,
	"priority" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vulnerability_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"repository_id" uuid,
	"scan_type" "scan_type" NOT NULL,
	"scanner_name" text NOT NULL,
	"scanner_version" text,
	"target_type" "target_type" NOT NULL,
	"target_identifier" text NOT NULL,
	"total_vulnerabilities" integer DEFAULT 0,
	"critical_count" integer DEFAULT 0,
	"high_count" integer DEFAULT 0,
	"medium_count" integer DEFAULT 0,
	"low_count" integer DEFAULT 0,
	"top_findings" text,
	"most_severe_finding" text,
	"scan_confidence" numeric(3, 2),
	"overall_risk_level" "risk_level",
	"risk_score" integer,
	"ai_analysis_summary" text,
	"top_remediation_suggestion" text,
	"estimated_fix_time" integer,
	"false_positive_rate" numeric(3, 2),
	"high_confidence_findings" integer DEFAULT 0,
	"remediated_count" integer DEFAULT 0,
	"remediation_progress" numeric(5, 2),
	"remediation_priority" text,
	"remediation_status" "remediation_status",
	"scan_started_at" timestamp,
	"scan_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"bio" text,
	"location" text,
	"company" text,
	"website" text,
	"preferred_language" text DEFAULT 'en',
	"timezone" text,
	"theme_preference" text DEFAULT 'system',
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT false,
	"marketing_emails" boolean DEFAULT false,
	"ai_model_preference" text DEFAULT 'gpt-4',
	"ai_tone_preference" text DEFAULT 'balanced',
	"ai_auto_complete" boolean DEFAULT true,
	"preferred_indentation" text DEFAULT 'spaces',
	"indent_size" integer DEFAULT 2,
	"prefer_semicolons" boolean DEFAULT true,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" text,
	"backup_codes_count" integer DEFAULT 0,
	"last_security_audit" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text,
	"description" text,
	"logo_url" text,
	"website" text,
	"timezone" text DEFAULT 'UTC',
	"language" text DEFAULT 'en',
	"email_domain" text,
	"two_factor_auth_enabled" boolean DEFAULT false,
	"billing_email" text,
	"billing_address" text,
	"tax_id" text,
	"payment_method" text,
	"plan_type" "plan_type" DEFAULT 'free',
	"max_projects" integer DEFAULT 1,
	"max_users" integer DEFAULT 5,
	"max_storage_gb" integer DEFAULT 1,
	"max_monthly_runs" integer DEFAULT 100,
	"current_projects" integer DEFAULT 0,
	"current_users" integer DEFAULT 0,
	"current_storage_gb" integer DEFAULT 0,
	"current_monthly_runs" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" varchar(50) DEFAULT 'bearer',
	"scope" text,
	"expires_at" timestamp,
	"github_data" jsonb,
	"gitlab_data" jsonb,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"scope" "role_scope" DEFAULT 'organization' NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"external_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_membership_role" DEFAULT 'member' NOT NULL,
	"status" "team_membership_status" DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"role" "project_member_role" DEFAULT 'developer' NOT NULL,
	"status" "project_member_status" DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_type" "role_assignment_scope" DEFAULT 'organization' NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"project_id" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"subscribed_events" text[],
	"settings" jsonb,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"failure_count" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"status" "webhook_event_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"response_code" integer,
	"response_body" text,
	"error_message" text,
	"delivered_at" timestamp,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"state" varchar(255) NOT NULL,
	"nonce" varchar(255),
	"code_verifier" text,
	"redirect_uri" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"used_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"error_code" varchar(100),
	"error_description" text
);
--> statement-breakpoint
CREATE TABLE "resource_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"environment_id" uuid,
	"resource_type" varchar(50) NOT NULL,
	"resource_name" varchar(100) NOT NULL,
	"usage_percentage" numeric(5, 2) NOT NULL,
	"cost_per_hour" numeric(10, 4) NOT NULL,
	"optimization_suggestion" text,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assistants" ADD CONSTRAINT "ai_assistants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assistants" ADD CONSTRAINT "ai_assistants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_assistant_id_ai_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."ai_assistants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_account_id_oauth_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."oauth_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_analysis_results" ADD CONSTRAINT "code_analysis_results_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_tracking" ADD CONSTRAINT "cost_tracking_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_pipeline_run_id_pipeline_runs_id_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligent_alerts" ADD CONSTRAINT "intelligent_alerts_monitor_config_id_monitoring_configs_id_fk" FOREIGN KEY ("monitor_config_id") REFERENCES "public"."monitoring_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligent_alerts" ADD CONSTRAINT "intelligent_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_trigger_user_id_users_id_fk" FOREIGN KEY ("trigger_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_configs" ADD CONSTRAINT "monitoring_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_configs" ADD CONSTRAINT "monitoring_configs_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability_scans" ADD CONSTRAINT "vulnerability_scans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerability_scans" ADD CONSTRAINT "vulnerability_scans_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_assistants_type_idx" ON "ai_assistants" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_assistants_specialization_idx" ON "ai_assistants" USING btree ("specialization");--> statement-breakpoint
CREATE INDEX "ai_assistants_created_by_idx" ON "ai_assistants" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "ai_assistants_organization_id_idx" ON "ai_assistants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_assistants_is_active_idx" ON "ai_assistants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ai_assistants_model_type_idx" ON "ai_assistants" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "ai_recommendations_assistant_idx" ON "ai_recommendations" USING btree ("assistant_id");--> statement-breakpoint
CREATE INDEX "ai_recommendations_context_idx" ON "ai_recommendations" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "ai_recommendations_priority_idx" ON "ai_recommendations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "code_analysis_results_repository_idx" ON "code_analysis_results" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "code_analysis_results_commit_idx" ON "code_analysis_results" USING btree ("commit_hash");--> statement-breakpoint
CREATE INDEX "code_analysis_results_analyzer_type_idx" ON "code_analysis_results" USING btree ("analyzer_type");--> statement-breakpoint
CREATE INDEX "code_analysis_results_branch_idx" ON "code_analysis_results" USING btree ("branch");--> statement-breakpoint
CREATE INDEX "code_analysis_results_created_at_idx" ON "code_analysis_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "code_analysis_results_repo_created_idx" ON "code_analysis_results" USING btree ("repository_id","created_at");--> statement-breakpoint
CREATE INDEX "cost_tracking_project_id_idx" ON "cost_tracking" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "cost_tracking_organization_id_idx" ON "cost_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cost_tracking_period_idx" ON "cost_tracking" USING btree ("period");--> statement-breakpoint
CREATE INDEX "cost_tracking_total_cost_idx" ON "cost_tracking" USING btree ("total_cost");--> statement-breakpoint
CREATE INDEX "cost_tracking_created_at_idx" ON "cost_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deployments_project_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deployments_environment_idx" ON "deployments" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deployments_deployed_by_idx" ON "deployments" USING btree ("deployed_by");--> statement-breakpoint
CREATE INDEX "environments_project_idx" ON "environments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "environments_type_idx" ON "environments" USING btree ("environment_type");--> statement-breakpoint
CREATE INDEX "environments_status_idx" ON "environments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "environments_provider_idx" ON "environments" USING btree ("cloud_provider");--> statement-breakpoint
CREATE UNIQUE INDEX "environments_project_name_unique" ON "environments" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "experiments_project_idx" ON "experiments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "experiments_feature_flag_idx" ON "experiments" USING btree ("feature_flag_id");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "experiments_date_range_idx" ON "experiments" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "intelligent_alerts_monitor_config_idx" ON "intelligent_alerts" USING btree ("monitor_config_id");--> statement-breakpoint
CREATE INDEX "intelligent_alerts_status_idx" ON "intelligent_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "intelligent_alerts_severity_idx" ON "intelligent_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "intelligent_alerts_type_idx" ON "intelligent_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "intelligent_alerts_acknowledged_by_idx" ON "intelligent_alerts" USING btree ("acknowledged_by");--> statement-breakpoint
CREATE INDEX "performance_metrics_timestamp_idx" ON "performance_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "performance_metrics_project_service_idx" ON "performance_metrics" USING btree ("project_id","service_name","timestamp");--> statement-breakpoint
CREATE INDEX "performance_metrics_project_idx" ON "performance_metrics" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "performance_metrics_category_idx" ON "performance_metrics" USING btree ("metric_category");--> statement-breakpoint
CREATE INDEX "performance_metrics_alert_idx" ON "performance_metrics" USING btree ("is_alert");--> statement-breakpoint
CREATE INDEX "projects_organization_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_visibility_idx" ON "projects" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "projects_ai_model_preference_idx" ON "projects" USING btree ("ai_model_preference");--> statement-breakpoint
CREATE INDEX "repositories_project_idx" ON "repositories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "repositories_provider_idx" ON "repositories" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "repositories_sync_status_idx" ON "repositories" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "repositories_provider_id_idx" ON "repositories" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_project_full_name_unique" ON "repositories" USING btree ("project_id","full_name");--> statement-breakpoint
CREATE INDEX "pipelines_project_idx" ON "pipelines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pipelines_repository_idx" ON "pipelines" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "pipelines_active_idx" ON "pipelines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pipelines_config_source_idx" ON "pipelines" USING btree ("config_source");--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_project_name_unique" ON "pipelines" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_idx" ON "pipeline_runs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_runs_trigger_user_idx" ON "pipeline_runs" USING btree ("trigger_user_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_run_number_idx" ON "pipeline_runs" USING btree ("pipeline_id","run_number");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_status_created_idx" ON "pipeline_runs" USING btree ("pipeline_id","status","created_at");--> statement-breakpoint
CREATE INDEX "monitoring_configs_project_idx" ON "monitoring_configs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "monitoring_configs_environment_idx" ON "monitoring_configs" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "monitoring_configs_type_idx" ON "monitoring_configs" USING btree ("monitor_type");--> statement-breakpoint
CREATE INDEX "monitoring_configs_active_idx" ON "monitoring_configs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "security_policies_project_id_idx" ON "security_policies" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "security_policies_environment_id_idx" ON "security_policies" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "security_policies_policy_type_idx" ON "security_policies" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "security_policies_status_idx" ON "security_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vulnerability_scans_project_idx" ON "vulnerability_scans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vulnerability_scans_repository_idx" ON "vulnerability_scans" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "vulnerability_scans_scan_type_idx" ON "vulnerability_scans" USING btree ("scan_type");--> statement-breakpoint
CREATE INDEX "vulnerability_scans_target_type_idx" ON "vulnerability_scans" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "vulnerability_scans_created_at_idx" ON "vulnerability_scans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vuln_scans_repo_severity_created_idx" ON "vulnerability_scans" USING btree ("repository_id","overall_risk_level","created_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");