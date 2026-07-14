import { services } from '@/lib/db/schema';
import {
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentInheritancePresentation,
} from '@/lib/environments/presentation';
import {
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
  type MigrationPolicySignalSnapshot,
} from '@/lib/policies/delivery';
import type { ReleaseServiceInput } from '@/lib/releases';
import { buildIssueSnapshot } from '@/lib/releases/intelligence';
import { resolveExecutableReleaseMigrationSpecs } from '@/lib/releases/migration-applicability';
import type {
  PlanningEnvironmentLike,
  PlanningMigrationSpecLike,
  PlanningServiceLike,
  ReleasePlanningSnapshot,
} from '@/lib/releases/planning-types';
import { inspectPreviewDatabaseGuard } from '@/lib/releases/preview-database-guard';
import type { ReleaseSchemaGateSnapshot } from '@/lib/schema-safety';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function dedupeMigrationSignals(
  signals: MigrationPolicySignalSnapshot[]
): MigrationPolicySignalSnapshot[] {
  const seen = new Set<string>();
  const result: MigrationPolicySignalSnapshot[] = [];

  for (const signal of signals) {
    if (seen.has(signal.code)) {
      continue;
    }
    seen.add(signal.code);
    result.push(signal);
  }

  return result;
}

export function resolvePlanningServices(
  projectId: string,
  projectServices: Array<typeof services.$inferSelect>,
  inputs: ReleaseServiceInput[]
): PlanningServiceLike[] {
  if (inputs.length === 0) {
    throw new Error('At least one release service artifact is required');
  }

  if (inputs.length === 1 && !inputs[0]?.id && !inputs[0]?.name && projectServices.length > 1) {
    throw new Error(
      'Multi-service projects must specify serviceId/serviceName or use services[] when creating a release'
    );
  }

  return inputs.map((input) => {
    let service =
      (input.id ? projectServices.find((candidate) => candidate.id === input.id) : undefined) ??
      (input.name ? projectServices.find((candidate) => candidate.name === input.name) : undefined);

    if (!service && projectServices.length === 1) {
      service = projectServices[0];
    }

    if (!service || service.projectId !== projectId) {
      throw new Error(
        `Unable to resolve service for release artifact ${input.name ?? input.id ?? input.image}`
      );
    }

    return {
      id: service.id,
      name: service.name,
      image: input.image,
      digest: input.digest ?? null,
    };
  });
}

export function summarizeReleasePlan(input: {
  environment: PlanningEnvironmentLike;
  services: PlanningServiceLike[];
  migrationSpecs: PlanningMigrationSpecLike[];
  migrationWarnings?: string[];
  schemaGate?: ReleaseSchemaGateSnapshot | null;
}): ReleasePlanningSnapshot {
  const schemaGate = input.schemaGate ?? null;
  const executableMigrationSpecs = resolveExecutableReleaseMigrationSpecs({
    migrationSpecs: input.migrationSpecs,
    schemaGate,
  });
  const preDeploySpecs = executableMigrationSpecs.filter(
    (spec) => spec.specification.phase === 'preDeploy'
  );
  const postDeploySpecs = executableMigrationSpecs.filter(
    (spec) => spec.specification.phase === 'postDeploy'
  );
  const automaticSpecs = executableMigrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'automatic'
  );
  const manualPlatformSpecs = executableMigrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'manual_platform'
  );
  const externalSpecs = executableMigrationSpecs.filter(
    (spec) => spec.specification.executionMode === 'external'
  );
  const preDeployManualPlatformCount = preDeploySpecs.filter(
    (spec) => spec.specification.executionMode === 'manual_platform'
  ).length;
  const preDeployExternalCount = preDeploySpecs.filter(
    (spec) => spec.specification.executionMode === 'external'
  ).length;
  const migrationDecisions = executableMigrationSpecs.map((spec) =>
    evaluateMigrationPolicy({
      environment: spec.environment,
      specification: spec.specification,
    })
  );
  const warnings = dedupe([
    ...migrationDecisions.flatMap((decision) => decision.warnings),
    ...(input.migrationWarnings ?? []),
  ]);
  const migrationSignals = dedupeMigrationSignals(
    migrationDecisions.flatMap((decision) => decision.signals)
  );
  const environmentPolicy = evaluateEnvironmentPolicy(input.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: input.environment,
    migrationRuns: executableMigrationSpecs.map((spec) => ({
      specification: spec.specification,
    })),
  });
  const previewDatabaseGuard = inspectPreviewDatabaseGuard({
    environment: input.environment,
    migrationSpecs: executableMigrationSpecs,
    schemaGate,
  });
  const requiresExternalCompletion = preDeployExternalCount > 0;
  const migrationSummary =
    preDeployManualPlatformCount > 0 || preDeployExternalCount > 0
      ? '发布创建后会进入前置迁移等待流程'
      : null;
  const blockingReason = previewDatabaseGuard.blockingReason ?? schemaGate?.blockingReason ?? null;
  const issue = releasePolicy.requiresApproval ? buildIssueSnapshot('approval_blocked') : null;
  const totalAutomatic = automaticSpecs.length;
  const environmentInheritance = getEnvironmentInheritancePresentation(input.environment);
  const environmentDatabaseStrategy = getEnvironmentDatabaseStrategyLabel(
    input.environment.databaseStrategy
  );
  const platformSignals = buildPlatformSignalSnapshot({
    customSignals: [
      ...previewDatabaseGuard.customSignals,
      ...(environmentInheritance
        ? [
            {
              key: environmentInheritance.key,
              label: environmentInheritance.label,
              tone: 'neutral' as const,
            },
          ]
        : []),
      ...(schemaGate?.customSignals ?? []),
    ],
    issue,
    customSummary: previewDatabaseGuard.summary ?? schemaGate?.summary ?? null,
    customNextActionLabel:
      previewDatabaseGuard.nextActionLabel ?? schemaGate?.nextActionLabel ?? null,
    environmentPolicySignals: environmentPolicy.signals,
    environmentPolicySignal: environmentPolicy.primarySignal,
    releasePolicySignals: releasePolicy.signals,
    releasePolicySignal: releasePolicy.primarySignal,
    migrationPolicySignals: migrationSignals,
    migrationPolicySignal: migrationSignals[0] ?? null,
  });

  return {
    canCreate: (schemaGate?.canCreate ?? true) && previewDatabaseGuard.canCreate,
    blockingReason,
    services: input.services,
    environmentPolicy,
    releasePolicy,
    issue,
    platformSignals,
    migration: {
      preDeployCount: preDeploySpecs.length,
      postDeployCount: postDeploySpecs.length,
      automaticCount: automaticSpecs.length,
      manualPlatformCount: manualPlatformSpecs.length,
      externalCount: externalSpecs.length,
      warnings,
      signals: migrationSignals,
      primarySignal: migrationSignals[0] ?? null,
      requiresApproval: releasePolicy.requiresApproval,
      requiresExternalCompletion,
    },
    schema: {
      checkedCount: schemaGate?.checkedCount ?? 0,
      blockingCount: schemaGate?.blockingCount ?? 0,
      states: schemaGate?.states ?? [],
      summary: schemaGate?.summary ?? null,
      nextActionLabel: schemaGate?.nextActionLabel ?? null,
      refresh: schemaGate?.refresh ?? {
        requested: false,
        queuedCount: 0,
        runningCount: 0,
        unavailableCount: 0,
        failedCount: 0,
        missingCount: 0,
      },
    },
    environmentInheritance: environmentInheritance?.label ?? null,
    environmentDatabaseStrategy,
    summary:
      blockingReason ??
      previewDatabaseGuard.summary ??
      schemaGate?.summary ??
      migrationSummary ??
      releasePolicy.summary ??
      environmentPolicy.summary ??
      environmentInheritance?.summary ??
      (totalAutomatic > 0 ? `包含 ${totalAutomatic} 项自动迁移` : null),
  };
}
