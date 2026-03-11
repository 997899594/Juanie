import { getK8sClient } from '@/lib/k8s';
import { JUANIE_LABELS } from './types';

/**
 * AppDestroyer - 资源清理器
 * 删除应用的所有 K8s 资源
 */
export class AppDestroyer {
  /**
   * 销毁应用（删除所有相关资源）
   */
  static async destroy(namespace: string, appName: string): Promise<void> {
    const { core, apps, custom } = getK8sClient();

    const labelSelector = `${JUANIE_LABELS.APP_NAME}=${appName},${JUANIE_LABELS.MANAGED_BY}=resource-manager`;

    console.log(`[AppDestroyer] Destroying app ${appName} in ${namespace}`);

    // 1. 删除 HTTPRoute
    try {
      const routes = (await custom.listNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        labelSelector,
      })) as { items: any[] };
      for (const route of routes.items) {
        await custom.deleteNamespacedCustomObject({
          group: 'gateway.networking.k8s.io',
          version: 'v1',
          namespace,
          plural: 'httproutes',
          name: route.metadata?.name!,
        });
        console.log(`[AppDestroyer] Deleted HTTPRoute: ${route.metadata?.name}`);
      }
    } catch (_e) {
      // Ignore
    }

    // 2. 删除 Service
    try {
      const services = await core.listNamespacedService({ namespace, labelSelector });
      for (const svc of services.items) {
        await core.deleteNamespacedService({ namespace, name: svc.metadata?.name! });
        console.log(`[AppDestroyer] Deleted Service: ${svc.metadata?.name}`);
      }
    } catch (_e) {
      // Ignore
    }

    // 3. 删除 Deployment
    try {
      const deployments = await apps.listNamespacedDeployment({ namespace, labelSelector });
      for (const dep of deployments.items) {
        await apps.deleteNamespacedDeployment({ namespace, name: dep.metadata?.name! });
        console.log(`[AppDestroyer] Deleted Deployment: ${dep.metadata?.name}`);
      }
    } catch (_e) {
      // Ignore
    }

    // 4. 删除 ConfigMap
    try {
      const configMaps = await core.listNamespacedConfigMap({ namespace, labelSelector });
      for (const cm of configMaps.items) {
        await core.deleteNamespacedConfigMap({ namespace, name: cm.metadata?.name! });
        console.log(`[AppDestroyer] Deleted ConfigMap: ${cm.metadata?.name}`);
      }
    } catch (_e) {
      // Ignore
    }

    // 5. 删除 Secret
    try {
      const secrets = await core.listNamespacedSecret({ namespace, labelSelector });
      for (const s of secrets.items) {
        await core.deleteNamespacedSecret({ namespace, name: s.metadata?.name! });
        console.log(`[AppDestroyer] Deleted Secret: ${s.metadata?.name}`);
      }
    } catch (_e) {
      // Ignore
    }

    console.log(`[AppDestroyer] App ${appName} destroyed`);
  }

  /**
   * 销毁整个 Namespace
   */
  static async destroyNamespace(name: string): Promise<void> {
    const { core } = getK8sClient();

    try {
      await core.deleteNamespace({ name });
      console.log(`[AppDestroyer] Deleted Namespace: ${name}`);
    } catch (e: any) {
      if ((e.code ?? e.statusCode) !== 404) {
        throw e;
      }
    }
  }
}
