import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { parseAllDocuments } from 'yaml';

const chartPath = 'deploy/k8s/charts/juanie';

interface KubernetesResource {
  kind?: string;
  metadata?: { name?: string };
  spec?: Record<string, unknown>;
}

function renderChart(args: string[]): KubernetesResource[] {
  const result = spawnSync('helm', ['template', 'juanie', chartPath, ...args], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr);
  }

  return parseAllDocuments(result.stdout)
    .map((document) => document.toJSON() as KubernetesResource | null)
    .filter((resource): resource is KubernetesResource => resource !== null);
}

function findResource(
  resources: KubernetesResource[],
  kind: string,
  name: string
): KubernetesResource {
  const resource = resources.find(
    (candidate) => candidate.kind === kind && candidate.metadata?.name === name
  );
  if (!resource) {
    throw new Error(`Missing ${kind}/${name}`);
  }
  return resource;
}

function collectSecretReferences(value: unknown, references: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectSecretReferences(item, references);
    return references;
  }
  if (!value || typeof value !== 'object') return references;

  const object = value as Record<string, unknown>;
  const secretRef = object.secretRef as { name?: unknown } | undefined;
  const secretKeyRef = object.secretKeyRef as { name?: unknown } | undefined;
  if (typeof secretRef?.name === 'string') references.push(secretRef.name);
  if (typeof secretKeyRef?.name === 'string') references.push(secretKeyRef.name);
  for (const child of Object.values(object)) collectSecretReferences(child, references);
  return references;
}

describe('Helm runtime Secret rendering', () => {
  it('uses the chart-managed Secret when no external source is configured', () => {
    const resources = renderChart(['--set', 'secret.existingSecret=']);
    findResource(resources, 'Secret', 'juanie-secret');
    expect(new Set(collectSecretReferences(resources))).toEqual(new Set(['juanie-secret']));
  });

  it('pins the Restate registration container to the curl image numeric identity', () => {
    const resources = renderChart([]);
    const registration = findResource(resources, 'Job', 'juanie-restate-register-1');
    const template = registration.spec?.template as
      | { spec?: { containers?: Array<{ securityContext?: Record<string, unknown> }> } }
      | undefined;
    const securityContext = template?.spec?.containers?.[0]?.securityContext;

    expect(securityContext?.runAsUser).toBe(101);
    expect(securityContext?.runAsGroup).toBe(102);
    expect(securityContext?.allowPrivilegeEscalation).toBe(false);
    expect(securityContext?.readOnlyRootFilesystem).toBe(true);
  });

  it('uses one existing Secret for every runtime consumer', () => {
    const resources = renderChart(['--set', 'secret.existingSecret=company-managed-secret']);
    expect(resources.some((resource) => resource.kind === 'Secret')).toBe(false);
    expect(new Set(collectSecretReferences(resources))).toEqual(
      new Set(['company-managed-secret'])
    );
  });

  it('uses the ExternalSecret target even when an existing Secret default is present', () => {
    const resources = renderChart([
      '--set',
      'externalSecret.enabled=true',
      '--set',
      'externalSecret.targetName=company-external-secret',
      '--set',
      'externalSecret.secretStoreRef.name=production-secrets',
      '--set',
      'externalSecret.data[0].secretKey=DATABASE_PASSWORD',
      '--set',
      'externalSecret.data[0].remoteRef.key=juanie/database-password',
    ]);
    const externalSecret = findResource(resources, 'ExternalSecret', 'company-external-secret');
    expect((externalSecret.spec?.target as { name?: string }).name).toBe('company-external-secret');
    expect(new Set(collectSecretReferences(resources))).toEqual(
      new Set(['company-external-secret'])
    );
  });
});
