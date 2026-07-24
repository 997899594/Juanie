import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { parseAllDocuments } from 'yaml';

const chartPath = 'deploy/k8s/charts/juanie';

interface KubernetesResource {
  kind?: string;
  metadata?: { name?: string; labels?: Record<string, string> };
  spec?: {
    selector?: { matchLabels?: Record<string, string> };
    template?: { metadata?: { labels?: Record<string, string> } };
    restate?: Record<string, unknown>;
    [key: string]: unknown;
  };
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

function collectContainerEnvironmentNames(resource: KubernetesResource): Set<string> {
  const template = resource.spec?.template as
    | {
        spec?: {
          containers?: Array<{ env?: Array<{ name?: string }> }>;
        };
      }
    | undefined;
  return new Set(
    template?.spec?.containers?.flatMap(
      (container) => container.env?.flatMap(({ name }) => (name ? [name] : [])) ?? []
    ) ?? []
  );
}

describe('Helm runtime Secret rendering', () => {
  it('uses only the chart-managed Secret for schema execution', () => {
    const resources = renderChart([
      '--set',
      'secret.existingSecret=',
      '--set',
      'schemaSync.enabled=true',
    ]);
    findResource(resources, 'Secret', 'juanie-secret');
    expect(new Set(collectSecretReferences(resources))).toEqual(new Set(['juanie-secret']));
    const expandJob = findResource(resources, 'Job', 'juanie-schema-expand');
    const expandPodSpec = (
      expandJob.spec?.template as {
        spec?: { serviceAccountName?: string; automountServiceAccountToken?: boolean };
      }
    )?.spec;
    expect(collectContainerEnvironmentNames(expandJob)).not.toContain('ENCRYPTION_MASTER_KEY_V0');
    expect(expandPodSpec?.serviceAccountName).toBe('default');
    expect(expandPodSpec?.automountServiceAccountToken).toBe(false);
    for (const name of [
      'juanie-web',
      'juanie-worker',
      'juanie-scheduler',
      'juanie-outbox-dispatcher',
    ]) {
      expect(
        collectContainerEnvironmentNames(findResource(resources, 'Deployment', name))
      ).not.toContain('ENCRYPTION_MASTER_KEY_V0');
    }
  });

  it('renders contract promotion only for an explicit epoch', () => {
    const defaultResources = renderChart([]);
    expect(
      defaultResources.some((resource) =>
        resource.metadata?.name?.startsWith('juanie-schema-contract')
      )
    ).toBe(false);

    const resources = renderChart(['--set-string', 'schemaSync.contractPromotionEpoch=20260723']);
    const serviceAccount = findResource(resources, 'ServiceAccount', 'juanie-schema-runner');
    const contractJob = findResource(resources, 'Job', 'juanie-schema-contract-20260723');
    const podSpec = (
      contractJob.spec?.template as {
        spec?: { serviceAccountName?: string; automountServiceAccountToken?: boolean };
      }
    )?.spec;

    expect(serviceAccount).toBeDefined();
    expect(podSpec?.serviceAccountName).toBe('juanie-schema-runner');
    expect(podSpec?.automountServiceAccountToken).toBe(false);
    expect(collectContainerEnvironmentNames(contractJob)).toContain(
      'CONTROL_PLANE_CONTRACT_PROMOTION'
    );
    expect(JSON.stringify(contractJob)).toContain('control-plane-contract');
    expect(JSON.stringify(contractJob)).toContain('20260723');
    expect(JSON.stringify(contractJob)).not.toContain('helm.sh/hook');
  });

  it('uses the Operator as the only Restate handler owner', () => {
    const resources = renderChart([
      '-f',
      `${chartPath}/values-prod.yaml`,
      '--set-string',
      'env.JUANIE_SOURCE_REVISION=12d57bc2bfcfcd3373dfd6640bec463bd71b027e',
    ]);
    const immutableDeployment = findResource(
      resources,
      'RestateDeployment',
      'juanie-restate-services'
    );
    const registrations = resources.filter(
      (resource) =>
        resource.metadata?.labels?.['app.kubernetes.io/component'] === 'restate-registration'
    );

    expect(immutableDeployment.spec?.restate).toEqual({
      drainDelaySeconds: 300,
      register: {
        service: {
          name: 'juanie-restate',
          namespace: 'juanie',
          port: 9070,
        },
      },
    });
    expect(immutableDeployment.spec?.selector?.matchLabels).toEqual({
      'app.kubernetes.io/name': 'juanie',
      'app.kubernetes.io/component': 'restate-handler',
      'juanie.art/restate-generation': 'operator',
    });
    expect(
      immutableDeployment.spec?.template?.metadata?.labels?.['juanie.art/restate-handler']
    ).toBe('true');
    expect(registrations).toEqual([]);
    expect(
      resources.some(
        (resource) =>
          resource.metadata?.name === 'juanie-restate-services' &&
          (resource.kind === 'Deployment' || resource.kind === 'Service')
      )
    ).toBe(false);
    expect(
      resources.some(
        (resource) => resource.metadata?.labels?.['juanie.art/restate-generation'] === 'legacy'
      )
    ).toBe(false);
    expect(resources.some((resource) => JSON.stringify(resource).includes('curlimages/curl'))).toBe(
      false
    );
    expect(
      resources.some((resource) =>
        JSON.stringify(resource).includes(['RESTATE', 'SERVICE', 'REGISTRATION', 'URL'].join('_'))
      )
    ).toBe(false);
    expect(
      resources.some((resource) =>
        JSON.stringify(resource).includes('http://juanie-restate-services:9080')
      )
    ).toBe(false);
  });

  it('protects highly available Operator-managed handlers with the matching PDB', () => {
    const resources = renderChart(['--set', 'replicaCount.restateHandler=2']);
    const disruptionBudget = findResource(
      resources,
      'PodDisruptionBudget',
      'juanie-restate-handler'
    );

    expect(disruptionBudget.spec?.selector?.matchLabels).toEqual({
      'app.kubernetes.io/name': 'juanie',
      'app.kubernetes.io/component': 'restate-handler',
    });
  });

  it('scopes the Kubernetes CA to workloads with ServiceAccount credentials', () => {
    const resources = renderChart([]);
    const caVariable = 'NODE_EXTRA_CA_CERTS';
    const config = findResource(resources, 'ConfigMap', 'juanie-config') as KubernetesResource & {
      data?: Record<string, string>;
    };

    expect(config.data?.[caVariable]).toBeUndefined();
    for (const name of ['juanie-web', 'juanie-worker', 'juanie-outbox-dispatcher']) {
      expect(
        collectContainerEnvironmentNames(findResource(resources, 'Deployment', name))
      ).not.toContain(caVariable);
    }
    expect(
      collectContainerEnvironmentNames(findResource(resources, 'Deployment', 'juanie-scheduler'))
    ).toContain(caVariable);
    expect(
      collectContainerEnvironmentNames(
        findResource(resources, 'RestateDeployment', 'juanie-restate-services')
      )
    ).toContain(caVariable);
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
