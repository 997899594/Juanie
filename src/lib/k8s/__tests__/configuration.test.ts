import { describe, expect, it } from 'bun:test';
import {
  KUBERNETES_SERVICE_ACCOUNT_CA_PATH,
  KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH,
  resolveKubernetesConfiguration,
} from '@/lib/k8s/configuration';

describe('Kubernetes runtime configuration', () => {
  it('does not infer access from the injected service host alone', () => {
    expect(
      resolveKubernetesConfiguration({ KUBERNETES_SERVICE_HOST: '10.43.0.1' }, () => false)
    ).toBe(null);
  });

  it('enables in-cluster access only when token and CA are mounted', () => {
    const mountedPaths = new Set([
      KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH,
      KUBERNETES_SERVICE_ACCOUNT_CA_PATH,
    ]);

    expect(
      resolveKubernetesConfiguration({ KUBERNETES_SERVICE_HOST: '10.43.0.1' }, (path) =>
        mountedPaths.has(path)
      )
    ).toEqual({ kind: 'in-cluster' });
  });

  it('prefers explicit kubeconfig content', () => {
    expect(
      resolveKubernetesConfiguration({
        KUBECONFIG_CONTENT: 'apiVersion: v1',
        KUBECONFIG: '/tmp/kubeconfig',
      })
    ).toEqual({ kind: 'content', content: 'apiVersion: v1' });
  });

  it('keeps an explicit kubeconfig path observable even when it is invalid', () => {
    expect(
      resolveKubernetesConfiguration({ KUBECONFIG: '/missing/kubeconfig' }, () => false)
    ).toEqual({ kind: 'file', path: '/missing/kubeconfig' });
  });

  it('discovers the default local kubeconfig when it exists', () => {
    expect(
      resolveKubernetesConfiguration({ HOME: '/home/juanie' }, (path) => {
        return path === '/home/juanie/.kube/config';
      })
    ).toEqual({ kind: 'file', path: '/home/juanie/.kube/config' });
  });
});
