import { and, eq, isNull, not, type SQL } from 'drizzle-orm';
import {
  getProjectAccessOrThrow,
  getProjectAccessWithRoleOrThrow,
  getProjectEnvironmentOrThrow,
  getProjectServiceOrThrow,
} from '@/lib/api/access';
import { db } from '@/lib/db';
import { environments, environmentVariables } from '@/lib/db/schema';
import { syncEnvVarsToK8s, syncServiceEnvVarsToK8s } from '@/lib/env-sync';
import { encryptEnvironmentSecret } from '@/lib/env-vars/envelope';
import { resolveEnvironmentVariableScope } from '@/lib/env-vars/scope';
import {
  getPlatformManagedRuntimeEnvKeyMessage,
  isPlatformManagedRuntimeEnvKey,
} from '@/lib/env-vars/system';
import { isK8sAvailable, rolloutRestartDeployments } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { canReadProjectRuntime } from '@/lib/policies/runtime-access';

const envVarLogger = logger.child({ component: 'env-var-control' });

interface EnvironmentVariableRecord {
  id: string;
  key: string;
  value: string | null;
  isSecret: boolean | null;
  injectionType: string | null;
  environmentId: string | null;
  serviceId: string | null;
  encryptedValue: string | null;
  iv: string | null;
  authTag: string | null;
  encryptionKeyVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WritableEnvironmentVariableScope {
  environmentId: string | null;
  serviceId: string | null;
  environment: {
    id: string;
    namespace: string | null;
  } | null;
}

export class EnvVarControlError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'EnvVarControlError';
  }
}

export function isEnvVarControlError(error: unknown): error is EnvVarControlError {
  return error instanceof EnvVarControlError;
}

function buildScopedConditions(input: {
  projectId: string;
  key?: string;
  environmentId: string | null;
  serviceId: string | null;
  excludeVariableId?: string;
}): SQL[] {
  const conditions: SQL[] = [eq(environmentVariables.projectId, input.projectId)];

  if (input.key) {
    conditions.push(eq(environmentVariables.key, input.key));
  }

  conditions.push(
    input.environmentId
      ? eq(environmentVariables.environmentId, input.environmentId)
      : isNull(environmentVariables.environmentId)
  );
  conditions.push(
    input.serviceId
      ? eq(environmentVariables.serviceId, input.serviceId)
      : isNull(environmentVariables.serviceId)
  );

  if (input.excludeVariableId) {
    conditions.push(not(eq(environmentVariables.id, input.excludeVariableId)));
  }

  return conditions;
}

async function resolveWritableScope(input: {
  projectId: string;
  environmentId?: string | null;
  serviceId?: string | null;
}): Promise<WritableEnvironmentVariableScope> {
  const environmentId = input.environmentId ?? null;
  const serviceId = input.serviceId ?? null;

  try {
    resolveEnvironmentVariableScope({ environmentId, serviceId });
  } catch (error) {
    throw new EnvVarControlError(
      400,
      error instanceof Error ? error.message : 'Invalid environment variable scope'
    );
  }

  const environment = environmentId
    ? await getProjectEnvironmentOrThrow(input.projectId, environmentId)
    : null;

  if (serviceId) {
    await getProjectServiceOrThrow(input.projectId, serviceId);
  }

  return {
    environmentId,
    serviceId,
    environment: environment
      ? {
          id: environment.id,
          namespace: environment.namespace ?? null,
        }
      : null,
  };
}

async function findProjectEnvironmentVariable(input: {
  projectId: string;
  variableId: string;
}): Promise<EnvironmentVariableRecord | null> {
  return (
    (await db.query.environmentVariables.findFirst({
      where: and(
        eq(environmentVariables.id, input.variableId),
        eq(environmentVariables.projectId, input.projectId)
      ),
    })) ?? null
  );
}

async function assertNoDuplicateVariable(input: {
  projectId: string;
  key: string;
  environmentId: string | null;
  serviceId: string | null;
  excludeVariableId?: string;
}): Promise<void> {
  const existing = await db.query.environmentVariables.findFirst({
    where: and(
      ...buildScopedConditions({
        projectId: input.projectId,
        key: input.key,
        environmentId: input.environmentId,
        serviceId: input.serviceId,
        excludeVariableId: input.excludeVariableId,
      })
    ),
    columns: {
      id: true,
    },
  });

  if (existing) {
    throw new EnvVarControlError(409, `Variable "${input.key}" already exists in this scope`);
  }
}

function assertUserWritableRuntimeEnvKey(key: string): void {
  if (isPlatformManagedRuntimeEnvKey(key)) {
    throw new EnvVarControlError(400, getPlatformManagedRuntimeEnvKeyMessage(key));
  }
}

async function encryptOrThrow(input: {
  projectId: string;
  environmentId?: string | null;
  serviceId?: string | null;
  key?: string;
  variableId?: string;
  plaintext: string;
  operation: 'create' | 'update';
}) {
  try {
    return await encryptEnvironmentSecret(input.plaintext, input.variableId);
  } catch (error) {
    envVarLogger.error(`Failed to encrypt secret value during variable ${input.operation}`, error, {
      projectId: input.projectId,
      environmentId: input.environmentId ?? null,
      serviceId: input.serviceId ?? null,
      key: input.key ?? null,
      variableId: input.variableId ?? null,
    });

    throw new EnvVarControlError(
      500,
      'Encryption unavailable',
      'Check K8s Secret juanie/juanie-master-key or ENCRYPTION_MASTER_KEY env var.'
    );
  }
}

async function reconcileEnvironmentRuntime(input: {
  projectId: string;
  environment: WritableEnvironmentVariableScope['environment'];
  serviceId?: string | null;
  restartRuntime?: boolean;
  logContext: Record<string, unknown>;
}): Promise<void> {
  const targetEnvironments = input.environment
    ? [input.environment]
    : await db.query.environments.findMany({
        where: eq(environments.projectId, input.projectId),
        columns: {
          id: true,
          namespace: true,
        },
      });

  if (targetEnvironments.length === 0) {
    return;
  }

  for (const environment of targetEnvironments) {
    await syncEnvVarsToK8s(input.projectId, environment.id).catch((error) => {
      envVarLogger.warn('Failed to sync env vars to Kubernetes', {
        ...input.logContext,
        projectId: input.projectId,
        environmentId: environment.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    });

    if (input.serviceId && environment.namespace) {
      await syncServiceEnvVarsToK8s(input.serviceId, environment.namespace).catch((error) => {
        envVarLogger.warn('Failed to sync service env vars to Kubernetes', {
          ...input.logContext,
          projectId: input.projectId,
          environmentId: environment.id,
          namespace: environment.namespace,
          serviceId: input.serviceId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }

    if (!input.restartRuntime || !isK8sAvailable() || !environment.namespace) {
      continue;
    }

    await rolloutRestartDeployments(environment.namespace).catch((error) => {
      envVarLogger.warn('Failed to trigger rollout restart after env var mutation', {
        ...input.logContext,
        projectId: input.projectId,
        environmentId: environment.id,
        namespace: environment.namespace,
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

export async function listEnvironmentVariablesForProject(input: {
  projectId: string;
  userId: string;
  environmentId?: string | null;
  serviceId?: string | null;
}) {
  const { member } = await getProjectAccessOrThrow(input.projectId, input.userId);
  if (!canReadProjectRuntime(member.role)) {
    throw new EnvVarControlError(403, 'Forbidden');
  }

  const scope = await resolveWritableScope({
    projectId: input.projectId,
    environmentId: input.environmentId,
    serviceId: input.serviceId,
  });

  const vars = await db.query.environmentVariables.findMany({
    where: and(
      ...buildScopedConditions({
        projectId: input.projectId,
        environmentId: scope.environmentId,
        serviceId: scope.serviceId,
      })
    ),
    columns: {
      id: true,
      key: true,
      value: true,
      isSecret: true,
      injectionType: true,
      environmentId: true,
      serviceId: true,
      createdAt: true,
      updatedAt: true,
      encryptedValue: false,
      iv: false,
      authTag: false,
    },
  });

  return vars.map((envVar) => ({
    ...envVar,
    value: envVar.isSecret ? null : envVar.value,
  }));
}

export async function createEnvironmentVariableForProject(input: {
  projectId: string;
  userId: string;
  key: string;
  value: string;
  isSecret: boolean;
  injectionType: 'runtime' | 'build';
  environmentId?: string | null;
  serviceId?: string | null;
  restartRuntime?: boolean;
}) {
  await getProjectAccessWithRoleOrThrow(
    input.projectId,
    input.userId,
    ['owner', 'admin'] as const,
    '环境变量变更只允许 owner 或 admin'
  );

  const scope = await resolveWritableScope({
    projectId: input.projectId,
    environmentId: input.environmentId,
    serviceId: input.serviceId,
  });

  await assertNoDuplicateVariable({
    projectId: input.projectId,
    key: input.key,
    environmentId: scope.environmentId,
    serviceId: scope.serviceId,
  });
  assertUserWritableRuntimeEnvKey(input.key);

  const insertData = input.isSecret
    ? await encryptOrThrow({
        projectId: input.projectId,
        environmentId: scope.environmentId,
        serviceId: scope.serviceId,
        key: input.key,
        plaintext: input.value,
        operation: 'create',
      }).then(({ id, encryptedValue, iv, authTag, keyVersion }) => ({
        id,
        projectId: input.projectId,
        key: input.key,
        value: null,
        isSecret: true,
        injectionType: input.injectionType,
        environmentId: scope.environmentId,
        serviceId: scope.serviceId,
        encryptedValue,
        iv,
        authTag,
        encryptionKeyVersion: keyVersion,
      }))
    : {
        projectId: input.projectId,
        key: input.key,
        value: input.value,
        isSecret: false,
        injectionType: input.injectionType,
        environmentId: scope.environmentId,
        serviceId: scope.serviceId,
        encryptedValue: null,
        iv: null,
        authTag: null,
        encryptionKeyVersion: null,
      };

  const [created] = await db.insert(environmentVariables).values(insertData).returning({
    id: environmentVariables.id,
    key: environmentVariables.key,
    isSecret: environmentVariables.isSecret,
    injectionType: environmentVariables.injectionType,
    environmentId: environmentVariables.environmentId,
    serviceId: environmentVariables.serviceId,
    createdAt: environmentVariables.createdAt,
  });

  if (input.injectionType === 'runtime') {
    await reconcileEnvironmentRuntime({
      projectId: input.projectId,
      environment: scope.environment,
      serviceId: scope.serviceId,
      restartRuntime: input.restartRuntime,
      logContext: {
        key: input.key,
        serviceId: scope.serviceId,
        operation: 'create',
      },
    });
  }

  return created;
}

export async function updateEnvironmentVariableForProject(input: {
  projectId: string;
  userId: string;
  variableId: string;
  key?: string;
  value?: string;
  isSecret?: boolean;
  injectionType?: 'runtime' | 'build';
  restartRuntime?: boolean;
}) {
  await getProjectAccessWithRoleOrThrow(
    input.projectId,
    input.userId,
    ['owner', 'admin'] as const,
    '环境变量变更只允许 owner 或 admin'
  );

  const envVar = await findProjectEnvironmentVariable({
    projectId: input.projectId,
    variableId: input.variableId,
  });

  if (!envVar) {
    throw new EnvVarControlError(404, 'Variable not found');
  }

  const nextKey = input.key ?? envVar.key;
  assertUserWritableRuntimeEnvKey(nextKey);

  if (nextKey !== envVar.key) {
    await assertNoDuplicateVariable({
      projectId: input.projectId,
      key: nextKey,
      environmentId: envVar.environmentId,
      serviceId: envVar.serviceId,
      excludeVariableId: envVar.id,
    });
  }

  const updateData: Partial<{
    key: string;
    value: string | null;
    isSecret: boolean;
    injectionType: string;
    encryptedValue: string | null;
    iv: string | null;
    authTag: string | null;
    encryptionKeyVersion: number | null;
    updatedAt: Date;
  }> = {
    updatedAt: new Date(),
  };

  if (input.key !== undefined) {
    updateData.key = input.key;
  }
  if (input.injectionType !== undefined) {
    updateData.injectionType = input.injectionType;
  }

  const finalIsSecret = input.isSecret ?? Boolean(envVar.isSecret);

  if (input.value !== undefined) {
    if (finalIsSecret) {
      const encrypted = await encryptOrThrow({
        projectId: input.projectId,
        environmentId: envVar.environmentId,
        serviceId: envVar.serviceId,
        variableId: envVar.id,
        key: nextKey,
        plaintext: input.value,
        operation: 'update',
      });

      updateData.value = null;
      updateData.encryptedValue = encrypted.encryptedValue;
      updateData.iv = encrypted.iv;
      updateData.authTag = encrypted.authTag;
      updateData.encryptionKeyVersion = encrypted.keyVersion;
      updateData.isSecret = true;
    } else {
      updateData.value = input.value;
      updateData.encryptedValue = null;
      updateData.iv = null;
      updateData.authTag = null;
      updateData.encryptionKeyVersion = null;
      updateData.isSecret = false;
    }
  } else if (input.isSecret !== undefined && input.isSecret !== Boolean(envVar.isSecret)) {
    if (input.isSecret && envVar.value !== null) {
      const encrypted = await encryptOrThrow({
        projectId: input.projectId,
        environmentId: envVar.environmentId,
        serviceId: envVar.serviceId,
        variableId: envVar.id,
        key: nextKey,
        plaintext: envVar.value,
        operation: 'update',
      });

      updateData.value = null;
      updateData.encryptedValue = encrypted.encryptedValue;
      updateData.iv = encrypted.iv;
      updateData.authTag = encrypted.authTag;
      updateData.encryptionKeyVersion = encrypted.keyVersion;
    } else if (!input.isSecret && envVar.encryptedValue) {
      throw new EnvVarControlError(
        400,
        'Cannot change a secret to non-secret without providing a new value'
      );
    }

    updateData.isSecret = input.isSecret;
  }

  await db
    .update(environmentVariables)
    .set(updateData)
    .where(eq(environmentVariables.id, envVar.id));

  const environment = envVar.environmentId
    ? await getProjectEnvironmentOrThrow(input.projectId, envVar.environmentId).then((record) => ({
        id: record.id,
        namespace: record.namespace ?? null,
      }))
    : null;

  if (envVar.injectionType !== 'build' || input.injectionType === 'runtime') {
    await reconcileEnvironmentRuntime({
      projectId: input.projectId,
      environment,
      serviceId: envVar.serviceId,
      restartRuntime: input.restartRuntime,
      logContext: {
        variableId: envVar.id,
        environmentId: envVar.environmentId,
        operation: 'update',
      },
    });
  }

  return { success: true };
}

export async function deleteEnvironmentVariableForProject(input: {
  projectId: string;
  userId: string;
  variableId: string;
  restartRuntime?: boolean;
}) {
  await getProjectAccessWithRoleOrThrow(
    input.projectId,
    input.userId,
    ['owner', 'admin'] as const,
    '环境变量变更只允许 owner 或 admin'
  );

  const envVar = await findProjectEnvironmentVariable({
    projectId: input.projectId,
    variableId: input.variableId,
  });

  if (!envVar) {
    throw new EnvVarControlError(404, 'Variable not found');
  }

  await db.delete(environmentVariables).where(eq(environmentVariables.id, envVar.id));

  const environment = envVar.environmentId
    ? await getProjectEnvironmentOrThrow(input.projectId, envVar.environmentId).then((record) => ({
        id: record.id,
        namespace: record.namespace ?? null,
      }))
    : null;

  if (envVar.injectionType !== 'build') {
    await reconcileEnvironmentRuntime({
      projectId: input.projectId,
      environment,
      serviceId: envVar.serviceId,
      restartRuntime: input.restartRuntime,
      logContext: {
        variableId: envVar.id,
        environmentId: envVar.environmentId,
        operation: 'delete',
      },
    });
  }

  return { success: true };
}
