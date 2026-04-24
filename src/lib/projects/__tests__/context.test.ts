import { describe, expect, it } from 'bun:test';
import {
  buildBranchHeadRef,
  getProjectProductionBranch,
  getProjectProductionRef,
  getProjectSourceRef,
  getRepositoryDefaultBranch,
} from '@/lib/projects/context';

describe('project context helpers', () => {
  it('falls back to main when a repository default branch is absent', () => {
    expect(getRepositoryDefaultBranch(null)).toBe('main');
  });

  it('prefers the explicit production branch before the repository default branch', () => {
    expect(
      getProjectProductionBranch({
        productionBranch: 'release',
        repository: { defaultBranch: 'main' },
      })
    ).toBe('release');
  });

  it('builds stable head refs for project production branches', () => {
    expect(getProjectProductionRef({ productionBranch: 'release' })).toBe('refs/heads/release');
    expect(getProjectProductionRef({ repository: { defaultBranch: 'main' } })).toBe(
      'refs/heads/main'
    );
  });

  it('keeps existing refs/heads values stable when normalizing branch refs', () => {
    expect(buildBranchHeadRef('refs/heads/feature/demo')).toBe('refs/heads/feature/demo');
  });

  it('uses the provided branch before falling back to the project production ref', () => {
    expect(
      getProjectSourceRef({
        branch: 'feature/demo',
        productionBranch: 'main',
      })
    ).toBe('refs/heads/feature/demo');

    expect(
      getProjectSourceRef({
        productionBranch: 'release',
      })
    ).toBe('refs/heads/release');
  });
});
