/**
 * 环境变量同步模块
 *
 * 将数据库中的环境变量（解密后）同步到 K8s Secret / ConfigMap。
 * 同步目标：
 *   - isSecret=true  → K8s Secret    命名：env-<environmentId 前8位>
 *   - isSecret=false → K8s ConfigMap 命名：config-<environmentId 前8位>
 *
 * 变量优先级（后者覆盖前者）：
 *   项目级（environmentId=null, serviceId=null）
 *   → 环境级（environmentId=X, serviceId=null）
 *   → 服务级（serviceId=X）
 */

import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environments, environmentVariables } from '@/lib/db/schema';
import { getEnvironmentLineage } from '@/lib/environments/inheritance';
import { isK8sAvailable, upsertConfigMap, upsertSecret } from '@/lib/k8s';
import { logger } from '@/lib/logger';

const envSyncLogger = logger.child({ component: 'env-sync' });

/**
 * 生成 K8s 资源名称（基于 environmentId 前8位，符合 K8s DNS-1123 规范）
 */
export function getK8sSecretName(environmentId: string): string {
  return `env-${environmentId.slice(0, 8)}`;
}

export function getK8sConfigMapName(environmentId: string): string {
  return `config-${environmentId.slice(0, 8)}`;
}

export function getK8sSvcSecretName(serviceId: string): string {
  return `svc-secret-${serviceId.slice(0, 8)}`;
}

export function getK8sSvcConfigMapName(serviceId: string): string {
  return `svc-config-${serviceId.slice(0, 8)}`;
}

/**
 * 将指定环境的所有变量同步到 K8s Secret / ConfigMap
 *
 * @param projectId  项目 ID
 * @param environmentId 环境 ID
 *
 * K8s 不可用时静默跳过（graceful degrade）
 */
export async function syncEnvVarsToK8s(projectId: string, environmentId: string): Promise<void> {
  if (!isK8sAvailable()) {
    envSyncLogger.debug('Kubernetes not connected, skipping environment sync', {
      projectId,
      environmentId,
    });
    return;
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  });

  if (environment && environment.projectId !== projectId) {
    throw new Error(`Environment ${environmentId} does not belong to project ${projectId}`);
  }

  if (!environment?.namespace) {
    envSyncLogger.debug('Environment has no namespace, skipping environment sync', {
      environmentId,
    });
    return;
  }

  const lineage = await getEnvironmentLineage(environmentId);
  const inheritedEnvironmentIds = lineage.map((item) => item.id);
  const scopeOrder = new Map<string, number>(lineage.map((item, index) => [item.id, index]));

  // 查询项目级 + 继承链环境级变量（不含服务级，服务级由部署时按 service 单独处理）
  const vars = await db.query.environmentVariables.findMany({
    where: and(
      eq(environmentVariables.projectId, projectId),
      or(
        // 项目级：无 environmentId 且无 serviceId
        and(isNull(environmentVariables.environmentId), isNull(environmentVariables.serviceId)),
        // 环境级：匹配当前环境或继承链环境，且无 serviceId
        and(
          inArray(environmentVariables.environmentId, inheritedEnvironmentIds),
          isNull(environmentVariables.serviceId)
        )
      )
    ),
  });

  vars.sort((left, right) => {
    const leftScope = left.environmentId ? (scopeOrder.get(left.environmentId) ?? -1) : -1;
    const rightScope = right.environmentId ? (scopeOrder.get(right.environmentId) ?? -1) : -1;

    if (leftScope !== rightScope) {
      return leftScope - rightScope;
    }

    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  });

  const secrets: Record<string, string> = {};
  const configs: Record<string, string> = {};

  for (const v of vars) {
    if (!v.key) continue;

    if (v.isSecret) {
      if (!v.encryptedValue || !v.iv || !v.authTag) {
        // 老格式：isSecret=true 但未加密（手动插入或旧版代码写入）
        // 自愈迁移：就地加密并回写 DB，之后走正常解密路径
        if (!v.value) {
          envSyncLogger.warn('Secret variable is missing both encrypted and plaintext values', {
            varId: v.id,
            key: v.key,
          });
          continue;
        }
        try {
          const encrypted = await encrypt(v.value);
          await db
            .update(environmentVariables)
            .set({
              value: null,
              encryptedValue: encrypted.encryptedValue,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
              updatedAt: new Date(),
            })
            .where(eq(environmentVariables.id, v.id));
          secrets[v.key] = v.value;
          envSyncLogger.info('Migrated plaintext environment secret to encrypted form', {
            varId: v.id,
            key: v.key,
          });
        } catch (e) {
          envSyncLogger.error('Failed to migrate plaintext environment secret', e, {
            varId: v.id,
            key: v.key,
          });
        }
      } else {
        try {
          secrets[v.key] = await decrypt(v.encryptedValue, v.iv, v.authTag);
        } catch (e) {
          envSyncLogger.error('Failed to decrypt environment variable', e, {
            varId: v.id,
            key: v.key,
          });
          throw new Error(`Failed to decrypt variable "${v.key}": ${(e as Error).message}`);
        }
      }
    } else {
      configs[v.key] = v.value ?? '';
    }
  }

  const namespace = environment.namespace;

  // 即使为空也 replace，这样删除最后一个变量时不会留下脏配置。
  await upsertSecret(namespace, getK8sSecretName(environmentId), secrets);
  envSyncLogger.info('Synced environment secrets to Kubernetes', {
    namespace,
    secretName: getK8sSecretName(environmentId),
    count: Object.keys(secrets).length,
  });

  await upsertConfigMap(namespace, getK8sConfigMapName(environmentId), configs);
  envSyncLogger.info('Synced environment config maps to Kubernetes', {
    namespace,
    configMapName: getK8sConfigMapName(environmentId),
    count: Object.keys(configs).length,
  });
}

/**
 * 将指定服务的服务级变量同步到 K8s Secret / ConfigMap
 *
 * 服务级变量优先级高于环境级，挂载在 envFrom 末尾实现覆盖。
 * 仅在该服务确实有服务级变量时才创建资源，避免 Pod 引用不存在的 ConfigMap。
 *
 * @returns hasSecrets  是否有服务级 Secret（调用方据此决定是否加入 envFrom）
 * @returns hasConfigs  是否有服务级 ConfigMap
 */
export async function syncServiceEnvVarsToK8s(
  serviceId: string,
  namespace: string
): Promise<{ hasSecrets: boolean; hasConfigs: boolean }> {
  if (!isK8sAvailable()) {
    return { hasSecrets: false, hasConfigs: false };
  }

  const vars = await db.query.environmentVariables.findMany({
    where: and(
      eq(environmentVariables.serviceId, serviceId),
      isNull(environmentVariables.environmentId)
    ),
  });

  const secrets: Record<string, string> = {};
  const configs: Record<string, string> = {};

  for (const v of vars) {
    if (!v.key) continue;

    if (v.isSecret) {
      if (!v.encryptedValue || !v.iv || !v.authTag) {
        if (!v.value) {
          envSyncLogger.warn(
            'Service secret variable is missing both encrypted and plaintext values',
            {
              varId: v.id,
              key: v.key,
            }
          );
          continue;
        }
        try {
          const encrypted = await encrypt(v.value);
          await db
            .update(environmentVariables)
            .set({
              value: null,
              encryptedValue: encrypted.encryptedValue,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
              updatedAt: new Date(),
            })
            .where(eq(environmentVariables.id, v.id));
          secrets[v.key] = v.value;
          envSyncLogger.info('Migrated plaintext service secret to encrypted form', {
            varId: v.id,
            key: v.key,
          });
        } catch (e) {
          envSyncLogger.error('Failed to migrate plaintext service secret', e, {
            varId: v.id,
            key: v.key,
          });
        }
      } else {
        try {
          secrets[v.key] = await decrypt(v.encryptedValue, v.iv, v.authTag);
        } catch (e) {
          envSyncLogger.error('Failed to decrypt service environment variable', e, {
            varId: v.id,
            key: v.key,
          });
          throw new Error(`Failed to decrypt service variable "${v.key}": ${(e as Error).message}`);
        }
      }
    } else {
      configs[v.key] = v.value ?? '';
    }
  }

  await upsertSecret(namespace, getK8sSvcSecretName(serviceId), secrets);
  envSyncLogger.info('Synced service secrets to Kubernetes', {
    namespace,
    secretName: getK8sSvcSecretName(serviceId),
    count: Object.keys(secrets).length,
  });

  await upsertConfigMap(namespace, getK8sSvcConfigMapName(serviceId), configs);
  envSyncLogger.info('Synced service config maps to Kubernetes', {
    namespace,
    configMapName: getK8sSvcConfigMapName(serviceId),
    count: Object.keys(configs).length,
  });

  return {
    hasSecrets: Object.keys(secrets).length > 0,
    hasConfigs: Object.keys(configs).length > 0,
  };
}
