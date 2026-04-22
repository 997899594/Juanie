import { describe, expect, it } from 'bun:test';
import {
  buildJuanieRepositoryCleanupPaths,
  isJuanieManagedGitLabCi,
} from '@/lib/queue/project-delete';

describe('project delete repository cleanup planning', () => {
  it('detects Juanie-managed GitLab CI files conservatively', () => {
    expect(
      isJuanieManagedGitLabCi(`
stages: [build]
build:
  script:
    - echo "$JUANIE_SOURCE_SHA"
    - curl -X POST "https://juanie.art/api/releases"
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

  it('always removes Juanie-owned files and only removes GitLab CI when it is managed by Juanie', () => {
    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'github',
        gitlabCiContent: null,
      })
    ).toEqual([
      'juanie.yaml',
      '.env.juanie.example',
      'JUANIE.md',
      '.github/workflows/juanie-ci.yml',
    ]);

    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'gitlab',
        gitlabCiContent: `
variables:
  SOURCE_SHA: "$JUANIE_SOURCE_SHA"
script:
  - cat juanie-ci-meta.json
`,
      })
    ).toEqual(['juanie.yaml', '.env.juanie.example', 'JUANIE.md', '.gitlab-ci.yml']);

    expect(
      buildJuanieRepositoryCleanupPaths({
        provider: 'gitlab-self-hosted',
        gitlabCiContent: 'stages: [test]',
      })
    ).toEqual(['juanie.yaml', '.env.juanie.example', 'JUANIE.md']);
  });
});
