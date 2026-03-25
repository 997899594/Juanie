import { describe, expect, it } from 'bun:test';
import { environments } from '@/lib/db/schema';
import { resolveEnvironment } from '@/lib/releases';

describe('resolveEnvironment', () => {
  const envs = [
    {
      id: 'env_preview_branch',
      projectId: 'project_1',
      name: 'preview-feature-release-intel',
      branch: 'feature/release-intel',
      tagPattern: null,
      isPreview: true,
      previewPrNumber: null,
      expiresAt: null,
      autoDeploy: true,
      isProduction: false,
      namespace: 'juanie-preview-feature-release-intel',
    },
    {
      id: 'env_preview_pr',
      projectId: 'project_1',
      name: 'preview-pr-42',
      branch: null,
      tagPattern: null,
      isPreview: true,
      previewPrNumber: 42,
      expiresAt: null,
      autoDeploy: true,
      isProduction: false,
      namespace: 'juanie-preview-pr-42',
    },
    {
      id: 'env_staging',
      projectId: 'project_1',
      name: 'staging',
      branch: 'main',
      tagPattern: null,
      isPreview: false,
      previewPrNumber: null,
      expiresAt: null,
      autoDeploy: true,
      isProduction: false,
      namespace: 'juanie-staging',
    },
    {
      id: 'env_production',
      projectId: 'project_1',
      name: 'production',
      branch: 'main',
      tagPattern: 'v*',
      isPreview: false,
      previewPrNumber: null,
      expiresAt: null,
      autoDeploy: false,
      isProduction: true,
      namespace: 'juanie-production',
    },
  ] as EnvironmentRecord[];

  type EnvironmentRecord = typeof environments.$inferSelect;

  it('prefers preview branch environments over staging', () => {
    expect(resolveEnvironment('refs/heads/feature/release-intel', envs)?.id).toBe(
      'env_preview_branch'
    );
  });

  it('resolves preview PR environments', () => {
    expect(resolveEnvironment('refs/pull/42/merge', envs)?.id).toBe('env_preview_pr');
  });

  it('falls back to branch environments for normal refs', () => {
    expect(resolveEnvironment('refs/heads/main', envs)?.id).toBe('env_staging');
  });

  it('uses tag patterns for production releases', () => {
    expect(resolveEnvironment('refs/tags/v1.2.3', envs)?.id).toBe('env_production');
  });
});
