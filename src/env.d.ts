export interface Env {
  DATABASE_HOST?: string;
  DATABASE_PORT?: string;
  DATABASE_NAME?: string;
  DATABASE_USER?: string;
  DATABASE_PASSWORD?: string;
  DATABASE_SSL_MODE?: string;
  POSTGRES_DB?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_PORT?: string;
  ATLAS_DATABASE_URL?: string;

  // NextAuth
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;

  // GitHub OAuth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  // GitLab OAuth
  GITLAB_CLIENT_ID?: string;
  GITLAB_CLIENT_SECRET?: string;

  // GitHub Token (for creating repos)
  GITHUB_TOKEN?: string;

  // K8s
  KUBE_CONFIG_PATH?: string;

  // App
  NODE_ENV: 'development' | 'production' | 'test';
  JUANIE_BASE_DOMAIN?: string;
  JUANIE_ARGOCD_NAMESPACE?: string;
  JUANIE_ARGOCD_PROJECT?: string;
  JUANIE_ARGOCD_DESTINATION_SERVER?: string;
  JUANIE_PREVIEW_APPLICATIONSET_ENABLED?: 'true' | 'false';
  JUANIE_PREVIEW_APPLICATIONSET_REPO_URL?: string;
  JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION?: string;
  JUANIE_PREVIEW_APPLICATIONSET_PATH?: string;
  ENABLE_HISTORY_RETENTION?: 'true' | 'false';
  HISTORY_RETENTION_SCHEDULE?: string;
  DEPLOYMENT_LOG_RETENTION_DAYS?: string;
  AUDIT_LOG_RETENTION_DAYS?: string;
  AI_PLUGIN_RUN_RETENTION_DAYS?: string;
  AI_PLUGIN_SNAPSHOT_RETENTION_DAYS?: string;
  MIGRATION_RUN_RETENTION_DAYS?: string;
  SCHEMA_REPAIR_ATLAS_RUN_RETENTION_DAYS?: string;

  // AI / 302.ai
  AI_ENABLED?: 'true' | 'false';
  AI_302_API_KEY?: string;
  AI_302_BASE_URL?: string;
  AI_DEFAULT_PLAN?: 'free' | 'pro' | 'scale' | 'enterprise';
  AI_MODEL?: string;
  AI_MODEL_PRO?: string;
  AI_MODEL_TOOL?: string;

  // Database console / DbGate
  DATABASE_CONSOLE_ENABLED?: 'true' | 'false';
  DATABASE_CONSOLE_LABEL?: string;
  DATABASE_CONSOLE_ACCESS_MODE_LABEL?: string;
  DATABASE_CONSOLE_SUMMARY?: string;
  DATABASE_CONSOLE_CHANGE_MANAGEMENT_SUMMARY?: string;
  DATABASE_CONSOLE_READONLY?: 'true' | 'false';
  DBGATE_ENABLED?: 'true' | 'false';
  DBGATE_NAMESPACE?: string;
  DBGATE_IMAGE?: string;
  DBGATE_READONLY?: 'true' | 'false';
  DBGATE_CPU_REQUEST?: string;
  DBGATE_CPU_LIMIT?: string;
  DBGATE_MEMORY_REQUEST?: string;
  DBGATE_MEMORY_LIMIT?: string;
  DBGATE_IDLE_TTL_MINUTES?: string;
  DBGATE_CONSOLE_CLEANUP_SCHEDULE?: string;
  ENABLE_DBGATE_CONSOLE_CLEANUP?: 'true' | 'false';
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
