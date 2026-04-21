import { describe, expect, it } from 'bun:test';
import {
  buildDeployImageReference,
  buildDeployImageRepository,
  resolveDeployImageReference,
  resolveDeployImageRepository,
} from '@/lib/deploy-images';

describe('deploy image helpers', () => {
  it('normalizes repository paths for the shared public registry', () => {
    expect(buildDeployImageRepository(' Owner/Repo ')).toBe('ghcr.io/owner/repo');
    expect(buildDeployImageReference('Owner/Repo', ' abc123 ')).toBe(
      'ghcr.io/owner/repo:sha-abc123'
    );
  });

  it('prefers the configured image repository when present', () => {
    expect(
      resolveDeployImageRepository({
        configJson: {
          imageName: ' registry.example.com/custom/app ',
        },
        repositoryFullName: 'owner/repo',
      })
    ).toBe('registry.example.com/custom/app');

    expect(
      resolveDeployImageReference(
        {
          configJson: {
            imageName: 'registry.example.com/custom/app',
          },
          repositoryFullName: 'owner/repo',
        },
        ' abc123 '
      )
    ).toBe('registry.example.com/custom/app:sha-abc123');
  });

  it('falls back to the repository-derived image when no explicit image is configured', () => {
    expect(
      resolveDeployImageRepository({
        repositoryFullName: 'owner/repo',
      })
    ).toBe('ghcr.io/owner/repo');

    expect(
      resolveDeployImageReference(
        {
          repositoryFullName: 'owner/repo',
        },
        'abc123'
      )
    ).toBe('ghcr.io/owner/repo:sha-abc123');
  });

  it('returns null when a deploy image reference cannot be resolved', () => {
    expect(resolveDeployImageRepository({})).toBe(null);
    expect(resolveDeployImageReference({}, 'abc123')).toBe(null);
    expect(
      resolveDeployImageReference(
        {
          repositoryFullName: 'owner/repo',
        },
        null
      )
    ).toBe(null);
  });
});
