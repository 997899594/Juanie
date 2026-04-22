import { loadAIEnvironmentContext } from '@/lib/ai/context/environment-context';
import { getEnvironmentVariableOverview } from '@/lib/env-vars/overview';

export interface EnvironmentEnvvarRiskEvidence {
  teamId: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  latestReleaseTitle: string | null;
  variables: {
    directCount: number;
    effectiveCount: number;
    inheritedCount: number;
    secretCount: number;
    serviceOverrideGroupCount: number;
    serviceOverrideVariableCount: number;
    summary: string;
  };
  examples: {
    inheritedKeys: string[];
    serviceOverrideKeys: string[];
    directKeys: string[];
  };
}

function buildVariableSummary(input: {
  effectiveCount: number;
  inheritedCount: number;
  secretCount: number;
  serviceOverrideGroupCount: number;
}): string {
  return [
    input.effectiveCount === 0 ? '没有生效变量' : `${input.effectiveCount} 个生效变量`,
    input.inheritedCount > 0 ? `${input.inheritedCount} 个继承` : null,
    input.secretCount > 0 ? `${input.secretCount} 个密文` : '没有密文变量',
    input.serviceOverrideGroupCount > 0 ? `${input.serviceOverrideGroupCount} 组服务覆盖` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function buildEnvironmentEnvvarRiskEvidence(input: {
  projectId: string;
  environmentId: string;
}): Promise<EnvironmentEnvvarRiskEvidence> {
  const [{ teamId, projectName, environment }, overview] = await Promise.all([
    loadAIEnvironmentContext(input),
    getEnvironmentVariableOverview(input.projectId, input.environmentId),
  ]);

  const inherited = overview.effective.filter((variable) => variable.inherited);
  const secretCount = overview.effective.filter((variable) => variable.isSecret).length;
  const serviceOverrideVariableCount = overview.serviceOverrides.reduce(
    (count, group) => count + group.variables.length,
    0
  );

  return {
    teamId,
    projectId: input.projectId,
    projectName,
    environmentId: environment.id,
    environmentName: environment.name,
    latestReleaseTitle: environment.latestReleaseCard?.title ?? null,
    variables: {
      directCount: overview.direct.length,
      effectiveCount: overview.effective.length,
      inheritedCount: inherited.length,
      secretCount,
      serviceOverrideGroupCount: overview.serviceOverrides.length,
      serviceOverrideVariableCount,
      summary: buildVariableSummary({
        effectiveCount: overview.effective.length,
        inheritedCount: inherited.length,
        secretCount,
        serviceOverrideGroupCount: overview.serviceOverrides.length,
      }),
    },
    examples: {
      inheritedKeys: inherited.slice(0, 5).map((variable) => variable.key),
      serviceOverrideKeys: overview.serviceOverrides
        .flatMap((group) => group.variables.map((variable) => variable.key))
        .slice(0, 5),
      directKeys: overview.direct.slice(0, 5).map((variable) => variable.key),
    },
  };
}
