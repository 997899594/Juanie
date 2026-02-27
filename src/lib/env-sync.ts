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

import { and, eq, isNull, or } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { environments, environmentVariables } from '@/lib/db/schema';
import { getIsConnected, upsertConfigMap, upsertSecret } from '@/lib/k8s';

// Simple console logger fallback
const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => console.log('[INFO]', msg, ctx || ''),
  error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => console.error('[ERROR]', msg, err?.message || err, ctx || {}),
  warn: (msg: string, ctx?: Record<string, unknown>) => console.warn('[WARN]', msg, ctx || ''),
};

/**
 * 生成 K8s 资源名称（基于 environmentId 前8位，符合 K8s DNS-1123 规范）
 */
export function getK8sSecretName(environmentId: string): string {
  return `env-${environmentId.slice(0, 8)}`;
}

export function getK8sConfigMapName(environmentId: string): string {
  return `config-${environmentId.slice(0, 8)}`;
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
  if (!getIsConnected()) {
    logger.debug('K8s not connected, skipping env var sync', { projectId, environmentId });
    return;
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  });

  if (!environment?.namespace) {
    logger.debug('Environment has no namespace, skipping env var sync', { environmentId });
    return;
  }

  // 查询项目级 + 当前环境级变量（不含服务级，服务级由部署时按 service 单独处理）
  const vars = await db.query.environmentVariables.findMany({
    where: and(
      eq(environmentVariables.projectId, projectId),
      or(
        // 项目级：无 environmentId 且无 serviceId
        and(isNull(environmentVariables.environmentId), isNull(environmentVariables.serviceId)),
        // 环境级：匹配当前 environmentId 且无 serviceId
        and(
          eq(environmentVariables.environmentId, environmentId),
          isNull(environmentVariables.serviceId)
        )
      )
    ),
  });

  const secrets: Record<string, string> = {};
  const configs: Record<string, string> = {};

  for (const v of vars) {
    if (!v.key) continue;

    if (v.isSecret) {
      if (!v.encryptedValue || !v.iv || !v.authTag) {
        logger.warn('Secret variable missing encryption fields, skipping', {
          varId: v.id,
          key: v.key,
        });
        continue;
      }
      try {
        secrets[v.key] = await decrypt(v.encryptedValue, v.iv, v.authTag);
      } catch (e) {
        logger.error('Failed to decrypt env var', e instanceof Error ? e : new Error(String(e)), { varId: v.id, key: v.key });
        throw new Error(`Failed to decrypt variable "${v.key}": ${(e as Error).message}`);
      }
    } else {
      configs[v.key] = v.value ?? '';
    }
  }

  const namespace = environment.namespace;

  // 同步 Secret（即使为空也 upsert，确保 K8s 资源存在）
  if (Object.keys(secrets).length > 0) {
    await upsertSecret(namespace, getK8sSecretName(environmentId), secrets);
    logger.info('Synced env secrets to K8s', {
      namespace,
      secretName: getK8sSecretName(environmentId),
      count: Object.keys(secrets).length,
    });
  }

  // 同步 ConfigMap
  if (Object.keys(configs).length > 0) {
    await upsertConfigMap(namespace, getK8sConfigMapName(environmentId), configs);
    logger.info('Synced env configs to K8s', {
      namespace,
      configMapName: getK8sConfigMapName(environmentId),
      count: Object.keys(configs).length,
    });
  }
}
