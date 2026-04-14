import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environmentVariables } from '@/lib/db/schema';
import { getEnvironmentLineage } from '@/lib/environments/inheritance';

interface VisibleEnvVarRecord {
  id: string;
  key: string;
  value: string | null;
  isSecret: boolean;
  environmentId: string | null;
  serviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectiveEnvironmentVariableRecord extends VisibleEnvVarRecord {
  inherited: boolean;
  sourceLabel: string;
}

export interface ServiceOverrideVariableRecord extends VisibleEnvVarRecord {
  overridesEnvironmentValue: boolean;
}

export interface ServiceOverrideGroup {
  serviceId: string;
  serviceName: string;
  variables: ServiceOverrideVariableRecord[];
}

export interface EnvironmentVariableOverview {
  direct: VisibleEnvVarRecord[];
  effective: EffectiveEnvironmentVariableRecord[];
  serviceOverrides: ServiceOverrideGroup[];
}

function toVisibleRecord(
  record: Pick<
    typeof environmentVariables.$inferSelect,
    'id' | 'key' | 'value' | 'isSecret' | 'environmentId' | 'serviceId' | 'createdAt' | 'updatedAt'
  >
): VisibleEnvVarRecord {
  return {
    ...record,
    isSecret: Boolean(record.isSecret),
    value: record.isSecret ? null : record.value,
  };
}

export async function getEnvironmentVariableOverview(
  projectId: string,
  environmentId: string
): Promise<EnvironmentVariableOverview> {
  const lineage = await getEnvironmentLineage(environmentId);
  const lineageIds = lineage.map((environment) => environment.id);
  const lineageNameById = new Map(lineage.map((environment) => [environment.id, environment.name]));

  const [directVars, effectiveCandidates, serviceOverrideVars] = await Promise.all([
    db.query.environmentVariables.findMany({
      where: and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.environmentId, environmentId),
        isNull(environmentVariables.serviceId)
      ),
      columns: {
        id: true,
        key: true,
        value: true,
        isSecret: true,
        environmentId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.query.environmentVariables.findMany({
      where: and(
        eq(environmentVariables.projectId, projectId),
        or(
          and(isNull(environmentVariables.environmentId), isNull(environmentVariables.serviceId)),
          and(
            inArray(environmentVariables.environmentId, lineageIds),
            isNull(environmentVariables.serviceId)
          )
        )
      ),
      columns: {
        id: true,
        key: true,
        value: true,
        isSecret: true,
        environmentId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.query.environmentVariables.findMany({
      where: and(
        eq(environmentVariables.projectId, projectId),
        isNull(environmentVariables.environmentId),
        isNotNull(environmentVariables.serviceId)
      ),
      columns: {
        id: true,
        key: true,
        value: true,
        isSecret: true,
        environmentId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        service: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const scopePriority = new Map(lineageIds.map((id, index) => [id, index]));
  const sortedEffectiveCandidates = [...effectiveCandidates].sort((left, right) => {
    const leftScope = left.environmentId ? (scopePriority.get(left.environmentId) ?? -1) : -1;
    const rightScope = right.environmentId ? (scopePriority.get(right.environmentId) ?? -1) : -1;

    if (leftScope !== rightScope) {
      return leftScope - rightScope;
    }

    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  });

  const effectiveByKey = new Map<string, EffectiveEnvironmentVariableRecord>();
  for (const record of sortedEffectiveCandidates) {
    const visible = toVisibleRecord(record);
    const inherited = Boolean(record.environmentId) && record.environmentId !== environmentId;
    const sourceLabel = !record.environmentId
      ? '项目级'
      : record.environmentId === environmentId
        ? '当前环境'
        : `继承自 ${lineageNameById.get(record.environmentId) ?? '基础环境'}`;

    effectiveByKey.set(record.key, {
      ...visible,
      inherited,
      sourceLabel,
    });
  }

  const effectiveKeys = new Set(effectiveByKey.keys());
  const groupedServiceOverrides = new Map<string, ServiceOverrideGroup>();

  for (const record of serviceOverrideVars) {
    if (!record.service) {
      continue;
    }

    const visible = toVisibleRecord(record);
    const group = groupedServiceOverrides.get(record.service.id) ?? {
      serviceId: record.service.id,
      serviceName: record.service.name,
      variables: [],
    };

    group.variables.push({
      ...visible,
      overridesEnvironmentValue: effectiveKeys.has(record.key),
    });
    groupedServiceOverrides.set(record.service.id, group);
  }

  const direct = directVars
    .map((record) => toVisibleRecord(record))
    .sort((left, right) => left.key.localeCompare(right.key));
  const effective = [...effectiveByKey.values()].sort((left, right) =>
    left.key.localeCompare(right.key)
  );
  const serviceOverrides = [...groupedServiceOverrides.values()]
    .map((group) => ({
      ...group,
      variables: group.variables.sort((left, right) => left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName));

  return {
    direct,
    effective,
    serviceOverrides,
  };
}
