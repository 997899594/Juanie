import type { deliveryRules, environments } from '@/lib/db/schema';
import { resolvePreviewEnvironment } from '@/lib/environments/preview';

type EnvironmentRecord = typeof environments.$inferSelect;
type DeliveryRuleRecord = typeof deliveryRules.$inferSelect;

export interface SourceEvent {
  sourceType: 'branch' | 'tag' | 'pull_request' | 'manual';
  ref: string;
  branch: string | null;
  tag: string | null;
  prNumber: number | null;
}

export interface EnvironmentRouteResolution {
  environment: EnvironmentRecord | null;
  rule: DeliveryRuleRecord | null;
  sourceEvent: SourceEvent;
}

function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  );
  return regex.test(value);
}

export function buildSourceEvent(ref: string): SourceEvent {
  const prMatch = ref.match(/^refs\/pull\/(\d+)\/(?:head|merge)$/);
  if (prMatch) {
    return {
      sourceType: 'pull_request',
      ref,
      branch: null,
      tag: null,
      prNumber: Number.parseInt(prMatch[1], 10),
    };
  }

  if (ref.startsWith('refs/tags/')) {
    return {
      sourceType: 'tag',
      ref,
      branch: null,
      tag: ref.slice('refs/tags/'.length),
      prNumber: null,
    };
  }

  if (ref.startsWith('refs/heads/')) {
    return {
      sourceType: 'branch',
      ref,
      branch: ref.slice('refs/heads/'.length),
      tag: null,
      prNumber: null,
    };
  }

  return {
    sourceType: 'manual',
    ref,
    branch: null,
    tag: null,
    prNumber: null,
  };
}

function sortRules(rules: DeliveryRuleRecord[]): DeliveryRuleRecord[] {
  return [...rules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function matchesRule(rule: DeliveryRuleRecord, sourceEvent: SourceEvent): boolean {
  if (!rule.isActive || rule.kind !== sourceEvent.sourceType) {
    return false;
  }

  if (rule.kind === 'manual') {
    return true;
  }

  if (!rule.pattern) {
    return false;
  }

  if (rule.kind === 'branch') {
    return sourceEvent.branch ? matchesGlob(rule.pattern, sourceEvent.branch) : false;
  }

  if (rule.kind === 'tag') {
    return sourceEvent.tag ? matchesGlob(rule.pattern, sourceEvent.tag) : false;
  }

  if (rule.kind === 'pull_request') {
    const prToken = sourceEvent.prNumber ? String(sourceEvent.prNumber) : null;
    return rule.pattern === '*' || (prToken ? matchesGlob(rule.pattern, prToken) : false);
  }

  return false;
}

function resolveLegacyEnvironment(
  sourceEvent: SourceEvent,
  environments: EnvironmentRecord[]
): EnvironmentRecord | null {
  if (sourceEvent.sourceType === 'pull_request') {
    return resolvePreviewEnvironment(sourceEvent.ref, environments) ?? null;
  }

  if (sourceEvent.sourceType === 'tag') {
    const tag = sourceEvent.tag;
    if (!tag) {
      return null;
    }

    return (
      environments.find(
        (environment) => environment.tagPattern && matchesGlob(environment.tagPattern, tag)
      ) ?? null
    );
  }

  if (sourceEvent.sourceType === 'branch') {
    const branch = sourceEvent.branch;
    if (!branch) {
      return null;
    }

    return (
      resolvePreviewEnvironment(sourceEvent.ref, environments) ??
      environments.find((environment) => environment.branch === branch) ??
      null
    );
  }

  return null;
}

function resolvePullRequestRoute(input: {
  sourceEvent: SourceEvent;
  environments: EnvironmentRecord[];
  rules: DeliveryRuleRecord[];
}): EnvironmentRouteResolution {
  const previewEnvironment = resolvePreviewEnvironment(input.sourceEvent.ref, input.environments);
  const previewRule = input.rules.find((rule) => matchesRule(rule, input.sourceEvent)) ?? null;

  if (previewEnvironment) {
    return {
      environment: previewEnvironment,
      rule: previewRule,
      sourceEvent: input.sourceEvent,
    };
  }

  return {
    environment: null,
    rule: previewRule,
    sourceEvent: input.sourceEvent,
  };
}

export function resolveEnvironmentRoute(input: {
  ref: string;
  environments: EnvironmentRecord[];
  deliveryRules: DeliveryRuleRecord[];
}): EnvironmentRouteResolution {
  const sourceEvent = buildSourceEvent(input.ref);
  const activeRules = sortRules(input.deliveryRules.filter((rule) => rule.isActive));

  if (activeRules.length === 0) {
    return {
      environment: resolveLegacyEnvironment(sourceEvent, input.environments),
      rule: null,
      sourceEvent,
    };
  }

  if (sourceEvent.sourceType === 'pull_request') {
    return resolvePullRequestRoute({
      sourceEvent,
      environments: input.environments,
      rules: activeRules,
    });
  }

  const matchingRule =
    activeRules.find((rule) => matchesRule(rule, sourceEvent) && rule.environmentId) ?? null;

  if (!matchingRule) {
    return {
      environment: null,
      rule: null,
      sourceEvent,
    };
  }

  const environment =
    input.environments.find((candidate) => candidate.id === matchingRule.environmentId) ?? null;

  return {
    environment,
    rule: matchingRule,
    sourceEvent,
  };
}
