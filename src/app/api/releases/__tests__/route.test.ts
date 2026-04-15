import { describe, expect, it } from 'bun:test';
import {
  getRepositoryAccessDeniedMessage,
  resolveRepositoryVerificationTarget,
} from '@/lib/releases/api-access';

describe('release API repository verification helpers', () => {
  it('builds the GitHub verification endpoint', () => {
    const target = resolveRepositoryVerificationTarget('findbiao/nexusnote', 'github', {
      webUrl: 'https://github.com/findbiao/nexusnote',
      cloneUrl: 'https://github.com/findbiao/nexusnote.git',
      serverUrl: null,
    });

    expect(target.url).toBe('https://api.github.com/repos/findbiao/nexusnote');
    expect(target.headers.Accept).toBe('application/vnd.github+json');
  });

  it('builds the hosted GitLab verification endpoint', () => {
    const target = resolveRepositoryVerificationTarget('group/nexusnote', 'gitlab', {
      webUrl: 'https://gitlab.com/group/nexusnote',
      cloneUrl: 'https://gitlab.com/group/nexusnote.git',
      serverUrl: null,
    });

    expect(target.url).toBe('https://gitlab.com/api/v4/projects/group%2Fnexusnote');
  });

  it('builds the self-hosted GitLab verification endpoint from the identity server URL', () => {
    const target = resolveRepositoryVerificationTarget('group/nexusnote', 'gitlab-self-hosted', {
      webUrl: 'https://gitlab.example.com/group/nexusnote',
      cloneUrl: 'https://gitlab.example.com/group/nexusnote.git',
      serverUrl: 'https://gitlab.example.com',
    });

    expect(target.url).toBe('https://gitlab.example.com/api/v4/projects/group%2Fnexusnote');
  });

  it('uses provider-specific access denied messages', () => {
    expect(getRepositoryAccessDeniedMessage('github')).toBe(
      'Token does not have access to this repository'
    );
    expect(getRepositoryAccessDeniedMessage('gitlab')).toBe(
      'Token does not have access to this GitLab repository'
    );
  });
});
