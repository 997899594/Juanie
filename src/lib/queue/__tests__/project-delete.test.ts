import { describe, expect, it } from 'bun:test';
import {
  buildJuanieRepositoryCleanupPaths,
  isJuanieManagedGitLabCi,
  removeJuanieGitLabComponent,
  shouldDeleteProjectPreviewApplicationSet,
} from '@/lib/queue/project-delete';

describe('project delete repository cleanup planning', () => {
  it('detects only the versioned Juanie GitLab component', () => {
    expect(
      isJuanieManagedGitLabCi(`
include:
  - remote: https://juanie.example/api/ci/components/gitlab/v1
`)
    ).toBe(true);

    expect(
      isJuanieManagedGitLabCi(`
stages: [test]
test:
  script:
    - npm test
`)
    ).toBe(false);
  });

  it('removes only provider bootstraps and leaves the user-owned declaration in place', () => {
    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'github',
        gitlabCiContent: null,
      })
    ).toEqual(['.github/workflows/juanie-ci.yml']);

    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'gitlab',
        gitlabCiContent: `
include:
  - remote: https://juanie.art/api/ci/components/gitlab/v1
`,
      })
    ).toEqual(['.gitlab-ci.yml']);

    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'gitlab-self-hosted',
        gitlabCiContent: 'stages: [test]',
      })
    ).toEqual([]);
  });

  it('removes the Juanie include without deleting unrelated GitLab jobs', () => {
    const updated = removeJuanieGitLabComponent(`
include:
  - local: /quality.yml
  - remote: https://juanie.example/api/ci/components/gitlab/v1
test:
  script: npm test
`);

    expect(updated).not.toBe(null);
    expect(updated).toContain('local: /quality.yml');
    expect(updated).toContain('script: npm test');
    expect(updated).not.toContain('/api/ci/components/gitlab/');
  });

  it('only deletes preview ApplicationSet when the project actually has preview environments', () => {
    expect(
      shouldDeleteProjectPreviewApplicationSet([
        { namespace: 'juanie-demo-prod', isPreview: false },
        { namespace: 'juanie-demo-staging', isPreview: false },
      ])
    ).toBe(false);

    expect(
      shouldDeleteProjectPreviewApplicationSet([
        { namespace: 'juanie-demo-prod', isPreview: false },
        { namespace: 'juanie-demo-preview-pr-7', isPreview: true },
      ])
    ).toBe(true);
  });
});
