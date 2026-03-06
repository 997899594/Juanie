import type { AppSpec, AppResources } from './types';
import { getJuanieLabels } from './types';
import { createHash } from 'crypto';

/**
 * AppBuilder - 纯函数资源生成器
 * 输入 AppSpec，输出 K8s 资源对象
 */
export class AppBuilder {
  /**
   * 构建所有 K8s 资源
   */
  static build(spec: AppSpec): AppResources {
    const labels = getJuanieLabels(spec);

    return {
      deployment: this.buildDeployment(spec, labels),
      service: this.buildService(spec, labels),
      configMap: this.buildConfigMap(spec, labels),
      secret: this.buildSecret(spec, labels),
      httpRoute: spec.hostname ? this.buildHTTPRoute(spec, labels) : undefined,
    };
  }

  /**
   * 生成 Deployment
   */
  private static buildDeployment(spec: AppSpec, labels: Record<string, string>): any {
    const envFrom: any[] = [];

    if (spec.env && Object.keys(spec.env).length > 0) {
      envFrom.push({ configMapRef: { name: `${spec.name}-config` } });
    }
    if (spec.secretEnv && Object.keys(spec.secretEnv).length > 0) {
      envFrom.push({ secretRef: { name: `${spec.name}-secret` } });
    }

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${spec.name}-web`,
        namespace: spec.namespace,
        labels: { ...labels, app: `${spec.name}-web` },
        annotations: {
          'juanie.dev/last-applied-spec': JSON.stringify(spec),
        },
      },
      spec: {
        replicas: spec.replicas,
        selector: {
          matchLabels: { app: `${spec.name}-web` },
        },
        template: {
          metadata: {
            labels: { app: `${spec.name}-web`, ...labels },
          },
          spec: {
            containers: [
              {
                name: 'web',
                image: `${spec.image.repository}:${spec.image.tag}`,
                imagePullPolicy: spec.image.pullPolicy,
                ports: [{ containerPort: spec.port, name: 'http', protocol: 'TCP' }],
                envFrom: envFrom.length > 0 ? envFrom : undefined,
                resources: spec.resources
                  ? {
                      requests: {
                        cpu: spec.resources.cpu?.request,
                        memory: spec.resources.memory?.request,
                      },
                      limits: {
                        cpu: spec.resources.cpu?.limit,
                        memory: spec.resources.memory?.limit,
                      },
                    }
                  : undefined,
                livenessProbe: spec.healthcheck
                  ? {
                      httpGet: { path: spec.healthcheck.path, port: 'http' },
                      initialDelaySeconds: spec.healthcheck.initialDelaySeconds,
                      periodSeconds: spec.healthcheck.periodSeconds,
                    }
                  : undefined,
                readinessProbe: spec.healthcheck
                  ? {
                      httpGet: { path: spec.healthcheck.path, port: 'http' },
                      initialDelaySeconds: spec.healthcheck.initialDelaySeconds,
                      periodSeconds: spec.healthcheck.periodSeconds,
                    }
                  : undefined,
              },
            ],
          },
        },
      },
    };
  }

  /**
   * 生成 Service
   */
  private static buildService(spec: AppSpec, labels: Record<string, string>): any {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${spec.name}-web`,
        namespace: spec.namespace,
        labels,
      },
      spec: {
        type: 'ClusterIP',
        selector: { app: `${spec.name}-web` },
        ports: [
          {
            name: 'http',
            port: 80,
            targetPort: 'http',
            protocol: 'TCP',
          },
        ],
      },
    };
  }

  /**
   * 生成 ConfigMap（仅当有非敏感环境变量时）
   */
  private static buildConfigMap(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.env || Object.keys(spec.env).length === 0) {
      return undefined;
    }

    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${spec.name}-config`,
        namespace: spec.namespace,
        labels,
      },
      data: spec.env,
    };
  }

  /**
   * 生成 Secret（仅当有敏感环境变量时）
   */
  private static buildSecret(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.secretEnv || Object.keys(spec.secretEnv).length === 0) {
      return undefined;
    }

    // Base64 encode secret values
    const data: Record<string, string> = {};
    const secretEnv = spec.secretEnv as Record<string, string>;
    for (const [key, value] of Object.entries(secretEnv)) {
      data[key] = Buffer.from(value).toString('base64');
    }

    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${spec.name}-secret`,
        namespace: spec.namespace,
        labels,
      },
      type: 'Opaque',
      data,
    };
  }

  /**
   * 生成 HTTPRoute（Cilium Gateway API）
   */
  private static buildHTTPRoute(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.hostname) {
      return undefined;
    }

    return {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: `${spec.name}-route`,
        namespace: spec.namespace,
        labels,
      },
      spec: {
        parentRefs: [
          {
            name: 'shared-gateway',
            namespace: 'juanie',
            sectionName: 'https',
          },
        ],
        hostnames: [spec.hostname],
        rules: [
          {
            matches: [
              {
                path: {
                  type: 'PathPrefix',
                  value: '/',
                },
              },
            ],
            backendRefs: [
              {
                name: `${spec.name}-web`,
                port: 80,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * 计算资源 Hash（用于漂移检测）
   */
  static hashResources(resources: AppResources): string {
    const content = JSON.stringify({
      deployment: resources.deployment.spec,
      service: resources.service.spec,
      configMap: resources.configMap?.data,
      secret: resources.secret ? Object.keys(resources.secret.data || {}) : undefined,
      httpRoute: resources.httpRoute?.spec,
    });
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}
