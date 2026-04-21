import { describe, expect, it } from 'bun:test';
import {
  buildPreviewApplicationSetManifest,
  buildPreviewEnvironmentApplicationName,
  buildProjectPreviewApplicationSetName,
  getPreviewApplicationSetSourceConfig,
  isPreviewApplicationSetEnvironment,
  requirePreviewApplicationSetSourceConfig,
  resetPreviewApplicationSetSourceConfigCache,
  usesPreviewApplicationSetStableRoutes,
} from '@/lib/environments/application-set';

describe('preview ApplicationSet helpers', () => {
  it('treats every preview environment as an ApplicationSet-managed environment', () => {
    const previousRepo = process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    const previousEnabled = process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED;

    process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL = 'https://example.com/juanie.git';
    delete process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED;
    resetPreviewApplicationSetSourceConfigCache();

    expect(
      isPreviewApplicationSetEnvironment({
        kind: 'preview',
      })
    ).toBe(true);
    expect(
      isPreviewApplicationSetEnvironment({
        kind: 'persistent',
      })
    ).toBe(false);
    expect(
      usesPreviewApplicationSetStableRoutes({
        kind: 'preview',
        deploymentStrategy: 'rolling',
      })
    ).toBe(true);
    expect(
      usesPreviewApplicationSetStableRoutes({
        kind: 'preview',
        deploymentStrategy: 'canary',
      })
    ).toBe(false);

    if (previousRepo === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL = previousRepo;
    }

    if (previousEnabled === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED = previousEnabled;
    }

    resetPreviewApplicationSetSourceConfigCache();
  });

  it('fails fast when preview ApplicationSet source config is missing', () => {
    const previousRepo = process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    const previousEnabled = process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED;

    delete process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED = 'false';
    resetPreviewApplicationSetSourceConfigCache();

    expect(() => requirePreviewApplicationSetSourceConfig()).toThrow(
      '预览环境已统一改为 Argo CD ApplicationSet 驱动'
    );

    if (previousRepo === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL = previousRepo;
    }

    if (previousEnabled === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_ENABLED = previousEnabled;
    }

    resetPreviewApplicationSetSourceConfigCache();
  });

  it('builds stable preview ApplicationSet names and Helm-backed source templates', () => {
    const manifest = buildPreviewApplicationSetManifest({
      project: {
        id: 'project_123',
        slug: 'nexusnote',
      },
      source: {
        argocdNamespace: 'argocd',
        applicationProject: 'default',
        destinationServer: 'https://kubernetes.default.svc',
        repoUrl: 'git@github.com:juanie/Juanie.git',
        targetRevision: 'open-source',
        path: 'deploy/k8s/charts/preview-scaffold',
      },
      elements: [
        {
          applicationName: buildPreviewEnvironmentApplicationName(
            'nexusnote',
            'preview-codex-interview-dual-mode-rework'
          ),
          projectId: 'project_123',
          projectSlug: 'nexusnote',
          environmentId: 'env_preview_123',
          environmentName: 'preview-codex-interview-dual-mode-rework',
          namespace: 'juanie-nexusnote-preview-codex-interview-dual-mode-rework',
          enableStableRoutes: 'true',
          servicesJson: JSON.stringify([
            {
              name: 'web',
              serviceName: 'nexusnote-web',
              port: 3000,
              targetPort: 3000,
            },
          ]),
          domainsJson: JSON.stringify([
            {
              routeName: 'route-preview-nexusnote',
              hostname: 'preview.nexusnote.juanie.art',
              serviceName: 'nexusnote-web',
              servicePort: 3000,
            },
          ]),
        },
      ],
    });
    const spec = manifest.spec as {
      generators: Array<{
        list: {
          elements: unknown[];
        };
      }>;
      template: {
        spec: {
          source: {
            path: string;
            helm: {
              values: string;
            };
          };
          syncPolicy: {
            syncOptions: string[];
          };
        };
      };
    };

    expect(manifest.metadata.name).toBe(buildProjectPreviewApplicationSetName('nexusnote'));
    expect(manifest.metadata.namespace).toBe('argocd');
    expect(spec.generators[0].list.elements.length).toBe(1);
    expect(spec.template.spec.source.path).toBe('deploy/k8s/charts/preview-scaffold');
    expect(spec.template.spec.syncPolicy.syncOptions).toContain('CreateNamespace=true');
    expect(spec.template.spec.source.helm.values).toContain('fromJson .servicesJson');
    expect(spec.template.spec.source.helm.values).toContain('enableStableRoutes');
  });

  it('prefers explicit env overrides for the preview ApplicationSet source config', () => {
    const previousRepo = process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    const previousRevision = process.env.JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION;
    const previousPath = process.env.JUANIE_PREVIEW_APPLICATIONSET_PATH;
    const previousNamespace = process.env.JUANIE_ARGOCD_NAMESPACE;
    const previousProject = process.env.JUANIE_ARGOCD_PROJECT;

    process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL = 'https://example.com/control-plane.git';
    process.env.JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION = 'main';
    process.env.JUANIE_PREVIEW_APPLICATIONSET_PATH = 'deploy/k8s/charts/preview-scaffold';
    process.env.JUANIE_ARGOCD_NAMESPACE = 'argocd';
    process.env.JUANIE_ARGOCD_PROJECT = 'default';
    resetPreviewApplicationSetSourceConfigCache();

    expect(getPreviewApplicationSetSourceConfig()).toEqual({
      argocdNamespace: 'argocd',
      applicationProject: 'default',
      destinationServer: 'https://kubernetes.default.svc',
      repoUrl: 'https://example.com/control-plane.git',
      targetRevision: 'main',
      path: 'deploy/k8s/charts/preview-scaffold',
    });

    if (previousRepo === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_REPO_URL = previousRepo;
    }

    if (previousRevision === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_TARGET_REVISION = previousRevision;
    }

    if (previousPath === undefined) {
      delete process.env.JUANIE_PREVIEW_APPLICATIONSET_PATH;
    } else {
      process.env.JUANIE_PREVIEW_APPLICATIONSET_PATH = previousPath;
    }

    if (previousNamespace === undefined) {
      delete process.env.JUANIE_ARGOCD_NAMESPACE;
    } else {
      process.env.JUANIE_ARGOCD_NAMESPACE = previousNamespace;
    }

    if (previousProject === undefined) {
      delete process.env.JUANIE_ARGOCD_PROJECT;
    } else {
      process.env.JUANIE_ARGOCD_PROJECT = previousProject;
    }

    resetPreviewApplicationSetSourceConfigCache();
  });
});
