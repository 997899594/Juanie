import { existsSync } from 'node:fs';

export const KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/token';
export const KUBERNETES_SERVICE_ACCOUNT_CA_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

export type KubernetesConfigurationSource =
  | { kind: 'in-cluster' }
  | { kind: 'content'; content: string }
  | { kind: 'file'; path: string };

export interface KubernetesConfigurationEnvironment {
  HOME?: string;
  KUBECONFIG?: string;
  KUBECONFIG_CONTENT?: string;
  KUBERNETES_SERVICE_HOST?: string;
}

export function resolveKubernetesConfiguration(
  env: KubernetesConfigurationEnvironment = process.env,
  pathExists: (path: string) => boolean = existsSync
): KubernetesConfigurationSource | null {
  if (env.KUBECONFIG_CONTENT) {
    return { kind: 'content', content: env.KUBECONFIG_CONTENT };
  }

  if (env.KUBECONFIG) {
    return { kind: 'file', path: env.KUBECONFIG };
  }

  if (env.KUBERNETES_SERVICE_HOST) {
    const hasServiceAccountCredentials =
      pathExists(KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH) &&
      pathExists(KUBERNETES_SERVICE_ACCOUNT_CA_PATH);
    return hasServiceAccountCredentials ? { kind: 'in-cluster' } : null;
  }

  if (env.HOME) {
    const defaultPath = `${env.HOME}/.kube/config`;
    if (pathExists(defaultPath)) {
      return { kind: 'file', path: defaultPath };
    }
  }

  return null;
}
