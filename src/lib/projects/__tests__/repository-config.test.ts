import { describe, expect, it } from 'bun:test';
import { readRepositoryJuanieConfig } from '@/lib/projects/repository-config';

const validConfig = `
services:
  - name: web
    type: web
    run:
      command: bun start
      port: 3000
`;

describe('repository Juanie config', () => {
  it('loads the canonical config from the exact source commit and records its digest', async () => {
    const requests: Array<{ path: string; ref: string }> = [];

    const result = await readRepositoryJuanieConfig({
      repository: 'acme/app',
      sourceCommitSha: 'a'.repeat(40),
      getFileContent: async (path, ref) => {
        requests.push({ path, ref });
        return validConfig;
      },
    });

    expect(requests).toEqual([{ path: 'juanie.yml', ref: 'a'.repeat(40) }]);
    expect(result.path).toBe('juanie.yml');
    expect(/^[a-f0-9]{64}$/.test(result.digest)).toBe(true);
    expect(result.config.services[0]?.name).toBe('web');
  });

  it('does not probe legacy paths or persisted configuration when juanie.yml is absent', async () => {
    const requestedPaths: string[] = [];

    let error: unknown;
    try {
      await readRepositoryJuanieConfig({
        repository: 'acme/app',
        sourceCommitSha: 'b'.repeat(40),
        getFileContent: async (path) => {
          requestedPaths.push(path);
          return null;
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toContain('juanie.yml was not found in acme/app');
    expect(requestedPaths).toEqual(['juanie.yml']);
  });

  it('rejects invalid configuration with commit lineage', async () => {
    const sha = 'c'.repeat(40);

    let error: unknown;
    try {
      await readRepositoryJuanieConfig({
        repository: 'acme/app',
        sourceCommitSha: sha,
        getFileContent: async () => 'services: []',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toContain(`Invalid juanie.yml at ${sha}`);
  });
});
