import { getK8sClient } from '@/lib/k8s';
import { AppBuilder } from './app-builder';
import type { AppResources, AppSpec } from './types';
import { JUANIE_LABELS } from './types';

/**
 * AppDeployer - 部署执行器
 * 使用 Server-Side Apply + Prune 实现幂等部署
 */
export class AppDeployer {
  /**
   * 部署应用（幂等操作）
   * 1. SSA Apply 新资源
   * 2. Prune 孤儿资源
   */
  static async deploy(spec: AppSpec): Promise<{ success: boolean; resources: AppResources }> {
    const resources = AppBuilder.build(spec);

    // 1. 确保 Namespace 存在
    await AppDeployer.ensureNamespace(spec.namespace);

    // 2. Apply 所有资源
    await AppDeployer.applyResource(resources.deployment);
    await AppDeployer.applyResource(resources.service);
    if (resources.configMap) {
      await AppDeployer.applyResource(resources.configMap);
    }
    if (resources.secret) {
      await AppDeployer.applyResource(resources.secret);
    }
    if (resources.httpRoute) {
      await AppDeployer.applyResource(resources.httpRoute);
    }

    // 3. Prune 孤儿资源
    await AppDeployer.pruneOrphans(spec.namespace, spec.name, resources);

    return { success: true, resources };
  }

  /**
   * Server-Side Apply 资源
   */
  private static async applyResource(resource: any): Promise<void> {
    const kind = resource.kind;
    const name = resource.metadata.name;

    // 添加 last-applied-configuration 注解
    resource.metadata.annotations = resource.metadata.annotations || {};
    resource.metadata.annotations['juanie.dev/last-applied-configuration'] =
      JSON.stringify(resource);

    try {
      if (kind === 'Deployment') {
        await AppDeployer.applyDeployment(resource);
      } else if (kind === 'Service') {
        await AppDeployer.applyService(resource);
      } else if (kind === 'ConfigMap') {
        await AppDeployer.applyConfigMap(resource);
      } else if (kind === 'Secret') {
        await AppDeployer.applySecret(resource);
      } else if (kind === 'HTTPRoute') {
        await AppDeployer.applyHTTPRoute(resource);
      }
    } catch (error) {
      console.error(`[AppDeployer] Failed to apply ${kind}/${name}:`, error);
      throw error;
    }
  }

  private static async applyDeployment(resource: any): Promise<void> {
    const { apps } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await apps.readNamespacedDeployment({ namespace, name });
      await apps.replaceNamespacedDeployment({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await apps.createNamespacedDeployment({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyService(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedService({ namespace, name });
      await core.replaceNamespacedService({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedService({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyConfigMap(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedConfigMap({ namespace, name });
      await core.replaceNamespacedConfigMap({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedConfigMap({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applySecret(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedSecret({ namespace, name });
      await core.replaceNamespacedSecret({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedSecret({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyHTTPRoute(resource: any): Promise<void> {
    const { custom } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await custom.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
      });
      await custom.replaceNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
        body: resource,
      });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await custom.createNamespacedCustomObject({
          group: 'gateway.networking.k8s.io',
          version: 'v1',
          namespace,
          plural: 'httproutes',
          body: resource,
        });
      } else {
        throw e;
      }
    }
  }

  /**
   * 清理孤儿资源
   * 删除带有 juanie.dev/app-name 标签但不在当前资源列表中的资源
   */
  private static async pruneOrphans(
    namespace: string,
    appName: string,
    currentResources: AppResources
  ): Promise<void> {
    const { core, custom } = getK8sClient();

    // 当前资源名称集合
    const currentNames = {
      configMap: currentResources.configMap?.metadata?.name,
      secret: currentResources.secret?.metadata?.name,
      httpRoute: currentResources.httpRoute?.metadata?.name,
    };

    const labelSelector = `${JUANIE_LABELS.APP_NAME}=${appName},${JUANIE_LABELS.MANAGED_BY}=resource-manager`;

    // 检查 ConfigMap
    try {
      const configMaps = await core.listNamespacedConfigMap({ namespace, labelSelector });
      for (const cm of configMaps.items) {
        if (cm.metadata?.name !== currentNames.configMap) {
          console.log(`[AppDeployer] Pruning orphan ConfigMap: ${cm.metadata?.name}`);
          await core.deleteNamespacedConfigMap({ namespace, name: cm.metadata?.name! });
        }
      }
    } catch (_e) {
      // Ignore errors in prune
    }

    // 检查 Secret
    try {
      const secrets = await core.listNamespacedSecret({ namespace, labelSelector });
      for (const s of secrets.items) {
        if (s.metadata?.name !== currentNames.secret) {
          console.log(`[AppDeployer] Pruning orphan Secret: ${s.metadata?.name}`);
          await core.deleteNamespacedSecret({ namespace, name: s.metadata?.name! });
        }
      }
    } catch (_e) {
      // Ignore errors in prune
    }

    // 检查 HTTPRoute
    try {
      const routes = (await custom.listNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        labelSelector,
      })) as { items: any[] };
      for (const route of routes.items) {
        if (route.metadata?.name !== currentNames.httpRoute) {
          console.log(`[AppDeployer] Pruning orphan HTTPRoute: ${route.metadata?.name}`);
          await custom.deleteNamespacedCustomObject({
            group: 'gateway.networking.k8s.io',
            version: 'v1',
            namespace,
            plural: 'httproutes',
            name: route.metadata?.name!,
          });
        }
      }
    } catch (_e) {
      // Ignore errors in prune
    }
  }

  /**
   * 确保 Namespace 存在
   */
  private static async ensureNamespace(name: string): Promise<void> {
    const { core } = getK8sClient();

    try {
      await core.readNamespace({ name });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespace({
          body: {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name },
          },
        });
      } else {
        throw e;
      }
    }
  }
}
