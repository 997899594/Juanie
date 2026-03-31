export interface Env {
  DATABASE_URL: string;

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

  // AI / 302.ai
  AI_ENABLED?: 'true' | 'false';
  AI_302_API_KEY?: string;
  AI_302_BASE_URL?: string;
  AI_DEFAULT_PLAN?: 'free' | 'pro' | 'scale' | 'enterprise';
  AI_MODEL?: string;
  AI_MODEL_PRO?: string;
  AI_MODEL_TOOL?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
