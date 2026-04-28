import { execFileSync } from 'node:child_process';
import { and, eq, inArray } from 'drizzle-orm';
import {
  type ArgoApplicationSetManifest,
  deleteArgoApplicationSet,
  upsertArgoApplicationSet,
} from '@/lib/argocd';
import { db } from '@/lib/db';
import type { EnvironmentDeploymentStrategy } from '@/lib/db/schema';
import { domains, environments, projects, services } from '@/lib/db/schema';
import { buildDomainRouteName, pickDefaultPublicService } from '@/lib/domains/defaults';
import { isPreviewEnvironment } from '@/lib/environments/model';
import { isK8sAvailable } from '@/lib/k8s';
import { buildK8sName, buildProjectScopedK8sName } from '@/lib/k8s/naming';

const DEFAULT_PREVIEW_SERVICE_PORT = 3000;
const DEFAULT_ARGOCD_NAMESPACE = 'argocd';
const DEFAULT_ARGOCD_PROJECT = 'default';
const DEFAULT_ARGOCD_DESTINATION_SERVER = 'https://kubernetes.default.svc';
const DEFAULT_PREVIEW_APPLICATIONSET_PATH = 'deploy/k8s/charts/preview-scaffold';

let cachedPreviewApplicationSetSourceConfig: PreviewApplicationSetSourceConfig | null | undefined;

interface PreviewApplicationSetServiceRecord {
  id: string;
  name: string;
  type: string;
  isPublic: boolean | null;
  port: number | null;
}

interface PreviewApplicationSetEnvironmentRecord {
  id: string;
  name: string;
  namespace: string | null;
  kind: 'production' | 'persistent' | 'preview';
  isPreview: boolean | null;
  deploymentStrategy: EnvironmentDeploymentStrategy;
}

interface PreviewApplicationSetDomainRecord {
  environmentId: string | null;
  serviceId: string | null;
  hostname: string;
}

interface PreviewApplicationSetElementService {
  name: string;
  serviceName: string;
  port: number;
  targetPort: number;
}

interface PreviewApplicationSetElementDomain {
  routeName: string;
  hostname: string;
  serviceName: string;
  servicePort: number;
}

interface PreviewApplicationSetElement {
  applicationName: string;
  projectId: string;
  projectSlug: string;
  environmentId: string;
  environmentName: string;
  namespace: string;
  enableStableRoutes: 'true' | 'false';
  servicesJson: string;
  domainsJson: string;
}

export interface PreviewApplicationSetSourceConfig {
  argocdNamespace: string;
  applicationProject: string;
  destinationServer: string;
  repoUrl: string;
  targetRevision: string;
  path: string;
}

export function buildProjectPreviewApplicationSetName(projectSlug: string): string {
  return buildK8sName(['preview-set', projectSlug], {
    fallback: 'preview-set',
  });
}

export function buildPreviewEnvironmentApplicationName(
  projectSlug: string,
  environmentName: string
): string {
  return buildK8sName(['preview', projectSlug, environmentName], {
    fallback: 'preview-app',
  });
}

function runGitCommand(args: string[]): string | null {
  try {
    const output = execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return output || null;
  } catch {
    return null;
  }
}

export function getPreviewApplicationSetSourceConfig(): PreviewApplicationSetSourceConfig | null {
  if (cachedPreviewApplicationSetSourceConfig !== undefined) {
    return cachedPreviewApplicationSetSourceConfig;
  }

  if (process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED === 'false') {
    cachedPreviewApplicationSetSourceConfig = null;
    return cachedPreviewApplicationSetSourceConfig;
  }

  const repoUrl =
    process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL?.trim() ||
    runGitCommand(['config', '--get', 'remote.origin.url']);

  if (!repoUrl) {
    cachedPreviewApplicationSetSourceConfig = null;
    return cachedPreviewApplicationSetSourceConfig;
  }

  cachedPreviewApplicationSetSourceConfig = {
    argocdNamespace: process.env.JUANIE_ARGOCD_NAMESPACE?.trim() || DEFAULT_ARGOCD_NAMESPACE,
    applicationProject: process.env.JUANIE_ARGOCD_PROJECT?.trim() || DEFAULT_ARGOCD_PROJECT,
    destinationServer:
      process.env.JUANIE_ARGOCD_DESTINATION_SERVER?.trim() || DEFAULT_ARGOCD_DESTINATION_SERVER,
    repoUrl,
    targetRevision:
      process.env.JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION?.trim() ||
      runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']) ||
      'main',
    path:
      process.env.JUANIE_PREVIEW_APPLICATIONSET_PATH?.trim() || DEFAULT_PREVIEW_APPLICATIONSET_PATH,
  };

  return cachedPreviewApplicationSetSourceConfig;
}

export function requirePreviewApplicationSetSourceConfig(): PreviewApplicationSetSourceConfig {
  const config = getPreviewApplicationSetSourceConfig();

  if (!config) {
    throw new Error(
      '预览环境已统一改为 Argo CD ApplicationSet 驱动，但当前缺少预览环境 GitOps 源配置，请设置 JUANIE_PREVIEW_APPLICATIONSET_REPO_URL / TARGET_REVISION / PATH'
    );
  }

  return config;
}

export function resetPreviewApplicationSetSourceConfigCache(): void {
  cachedPreviewApplicationSetSourceConfig = undefined;
}

export function isPreviewApplicationSetEnvironment(environment: {
  kind?: 'production' | 'persistent' | 'preview' | null;
  isPreview?: boolean | null;
}): boolean {
  return isPreviewEnvironment(environment);
}

export function usesPreviewApplicationSetStableRoutes(environment: {
  kind?: 'production' | 'persistent' | 'preview' | null;
  isPreview?: boolean | null;
  deploymentStrategy?: EnvironmentDeploymentStrategy | null;
}): boolean {
  return (
    isPreviewApplicationSetEnvironment(environment) && environment.deploymentStrategy !== 'canary'
  );
}

function buildServiceResourceName(projectSlug: string, serviceName: string): string {
  return buildProjectScopedK8sName(projectSlug, serviceName);
}

function buildPreviewApplicationSetElement(input: {
  project: {
    id: string;
    slug: string;
  };
  environment: PreviewApplicationSetEnvironmentRecord;
  serviceList: PreviewApplicationSetServiceRecord[];
  domainList: PreviewApplicationSetDomainRecord[];
}): PreviewApplicationSetElement | null {
  if (!input.environment.namespace) {
    return null;
  }

  const defaultPublicService = pickDefaultPublicService(input.serviceList);
  const servicesForElement: PreviewApplicationSetElementService[] = input.serviceList.map(
    (service) => {
      const port = service.port ?? DEFAULT_PREVIEW_SERVICE_PORT;

      return {
        name: service.name,
        serviceName: buildServiceResourceName(input.project.slug, service.name),
        port,
        targetPort: port,
      };
    }
  );
  const domainsForElement: PreviewApplicationSetElementDomain[] = input.domainList
    .map((domain) => {
      const service =
        (domain.serviceId
          ? input.serviceList.find((candidate) => candidate.id === domain.serviceId)
          : undefined) ?? defaultPublicService;

      if (!service || service.type !== 'web' || service.isPublic === false) {
        return null;
      }

      return {
        routeName: buildDomainRouteName(domain.hostname),
        hostname: domain.hostname,
        serviceName: buildServiceResourceName(input.project.slug, service.name),
        servicePort: service.port ?? DEFAULT_PREVIEW_SERVICE_PORT,
      };
    })
    .filter((domain): domain is PreviewApplicationSetElementDomain => domain !== null);

  return {
    applicationName: buildPreviewEnvironmentApplicationName(
      input.project.slug,
      input.environment.name
    ),
    projectId: input.project.id,
    projectSlug: input.project.slug,
    environmentId: input.environment.id,
    environmentName: input.environment.name,
    namespace: input.environment.namespace,
    enableStableRoutes: usesPreviewApplicationSetStableRoutes(input.environment) ? 'true' : 'false',
    servicesJson: JSON.stringify(servicesForElement),
    domainsJson: JSON.stringify(domainsForElement),
  };
}

export function buildPreviewApplicationSetManifest(input: {
  project: {
    id: string;
    slug: string;
  };
  source: PreviewApplicationSetSourceConfig;
  elements: PreviewApplicationSetElement[];
}): ArgoApplicationSetManifest {
  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'ApplicationSet',
    metadata: {
      name: buildProjectPreviewApplicationSetName(input.project.slug),
      namespace: input.source.argocdNamespace,
      labels: {
        'app.kubernetes.io/managed-by': 'juanie',
        'juanie.dev/project-id': input.project.id,
        'juanie.dev/project-slug': input.project.slug,
        'juanie.dev/runtime': 'preview-applicationset',
      },
    },
    spec: {
      goTemplate: true,
      goTemplateOptions: ['missingkey=error'],
      generators: [
        {
          list: {
            elements: input.elements,
          },
        },
      ],
      template: {
        metadata: {
          name: '{{ .applicationName }}',
          labels: {
            'app.kubernetes.io/managed-by': 'juanie',
            'juanie.dev/project-id': '{{ .projectId }}',
            'juanie.dev/project-slug': '{{ .projectSlug }}',
            'juanie.dev/environment-id': '{{ .environmentId }}',
            'juanie.dev/environment-name': '{{ .environmentName }}',
            'juanie.dev/environment-kind': 'preview',
          },
        },
        spec: {
          project: input.source.applicationProject,
          source: {
            repoURL: input.source.repoUrl,
            targetRevision: input.source.targetRevision,
            path: input.source.path,
            helm: {
              releaseName: '{{ .applicationName }}',
              values: `projectSlug: {{ .projectSlug | quote }}
environmentId: {{ .environmentId | quote }}
environmentName: {{ .environmentName | quote }}
namespace: {{ .namespace | quote }}
enableStableRoutes: {{ eq .enableStableRoutes "true" }}
services:
{{- range $service := fromJson .servicesJson }}
  - name: {{ $service.name | quote }}
    serviceName: {{ $service.serviceName | quote }}
    port: {{ $service.port }}
    targetPort: {{ $service.targetPort }}
{{- end }}
domains:
{{- range $domain := fromJson .domainsJson }}
  - routeName: {{ $domain.routeName | quote }}
    hostname: {{ $domain.hostname | quote }}
    serviceName: {{ $domain.serviceName | quote }}
    servicePort: {{ $domain.servicePort }}
{{- end }}
`,
            },
          },
          destination: {
            server: input.source.destinationServer,
            namespace: '{{ .namespace }}',
          },
          syncPolicy: {
            automated: {
              prune: true,
              selfHeal: true,
            },
            managedNamespaceMetadata: {
              labels: {
                'app.kubernetes.io/managed-by': 'juanie',
                'juanie.dev/project-id': '{{ .projectId }}',
                'juanie.dev/project-slug': '{{ .projectSlug }}',
                'juanie.dev/environment-id': '{{ .environmentId }}',
                'juanie.dev/environment-name': '{{ .environmentName }}',
                'juanie.dev/environment-kind': 'preview',
              },
            },
            syncOptions: ['CreateNamespace=true', 'ServerSideApply=true'],
          },
        },
      },
      syncPolicy: {
        preserveResourcesOnDeletion: false,
      },
    },
  } as const;
}

async function loadProjectPreviewApplicationSetElements(input: {
  projectId: string;
  excludeEnvironmentIds?: string[];
}): Promise<{
  project: {
    id: string;
    slug: string;
  };
  elements: PreviewApplicationSetElement[];
} | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: {
      id: true,
      slug: true,
    },
  });

  if (!project) {
    return null;
  }

  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, input.projectId),
    columns: {
      id: true,
      name: true,
      type: true,
      isPublic: true,
      port: true,
    },
  });
  const previewEnvironmentList = (
    await db.query.environments.findMany({
      where: and(eq(environments.projectId, input.projectId), eq(environments.kind, 'preview')),
      columns: {
        id: true,
        name: true,
        namespace: true,
        kind: true,
        isPreview: true,
        deploymentStrategy: true,
      },
    })
  ).filter(
    (environment) => !input.excludeEnvironmentIds?.includes(environment.id)
  ) as PreviewApplicationSetEnvironmentRecord[];

  const previewEnvironmentIds = previewEnvironmentList.map((environment) => environment.id);
  const domainList =
    previewEnvironmentIds.length > 0
      ? ((await db.query.domains.findMany({
          where: and(
            eq(domains.projectId, input.projectId),
            inArray(domains.environmentId, previewEnvironmentIds)
          ),
          columns: {
            environmentId: true,
            serviceId: true,
            hostname: true,
          },
        })) as PreviewApplicationSetDomainRecord[])
      : [];
  const domainsByEnvironmentId = new Map<string, PreviewApplicationSetDomainRecord[]>();

  for (const domain of domainList) {
    if (!domain.environmentId) {
      continue;
    }

    const existing = domainsByEnvironmentId.get(domain.environmentId) ?? [];
    existing.push(domain);
    domainsByEnvironmentId.set(domain.environmentId, existing);
  }

  const elements = previewEnvironmentList
    .map((environment) =>
      buildPreviewApplicationSetElement({
        project,
        environment,
        serviceList: serviceList as PreviewApplicationSetServiceRecord[],
        domainList: domainsByEnvironmentId.get(environment.id) ?? [],
      })
    )
    .filter((element): element is PreviewApplicationSetElement => element !== null);

  return {
    project,
    elements,
  };
}

export async function syncProjectPreviewApplicationSet(input: {
  projectId: string;
  excludeEnvironmentIds?: string[];
}): Promise<number> {
  if (!isK8sAvailable()) {
    return 0;
  }

  const source = requirePreviewApplicationSetSourceConfig();

  const inventory = await loadProjectPreviewApplicationSetElements(input);
  if (!inventory) {
    return 0;
  }

  const applicationSetName = buildProjectPreviewApplicationSetName(inventory.project.slug);
  if (inventory.elements.length === 0) {
    await deleteArgoApplicationSet(source.argocdNamespace, applicationSetName);
    return 0;
  }

  await upsertArgoApplicationSet(
    buildPreviewApplicationSetManifest({
      project: inventory.project,
      source,
      elements: inventory.elements,
    })
  );

  return inventory.elements.length;
}

export async function deleteProjectPreviewApplicationSet(projectSlug: string): Promise<void> {
  if (!isK8sAvailable()) {
    return;
  }
  const source = requirePreviewApplicationSetSourceConfig();

  await deleteArgoApplicationSet(
    source.argocdNamespace,
    buildProjectPreviewApplicationSetName(projectSlug)
  );
}
