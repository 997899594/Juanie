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
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}
