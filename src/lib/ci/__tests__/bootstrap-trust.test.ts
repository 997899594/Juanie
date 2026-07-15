import { describe, expect, it } from 'bun:test';
import { assertTrustedGitLabBootstrap } from '@/lib/ci/bootstrap-trust';

const trusted = {
  componentUrl: 'https://juanie.example.com/api/ci/components/gitlab/v1',
  componentIntegrity: 'sha256-trusted',
  baseUrl: 'https://juanie.example.com',
};

function bootstrap(overrides = ''): string {
  return `include:
  - remote: ${trusted.componentUrl}
    integrity: ${trusted.componentIntegrity}
    inputs:
      juanie_base_url: ${trusted.baseUrl}
${overrides}`;
}

describe('GitLab CI bootstrap trust', () => {
  it('accepts the exact deployed Component while preserving unrelated jobs', () => {
    expect(() =>
      assertTrustedGitLabBootstrap(bootstrap('quality:\n  script: bun test\n'), trusted)
    ).not.toThrow();
  });

  it('rejects missing, duplicated, moved, or integrity-mismatched Components', () => {
    expect(() => assertTrustedGitLabBootstrap('quality:\n  script: bun test\n', trusted)).toThrow(
      'exactly one'
    );
    expect(() =>
      assertTrustedGitLabBootstrap(
        `${bootstrap()}  - remote: ${trusted.componentUrl}\n    integrity: ${trusted.componentIntegrity}\n`,
        trusted
      )
    ).toThrow('exactly one');
    expect(() =>
      assertTrustedGitLabBootstrap(
        bootstrap().replace('sha256-trusted', 'sha256-attacker'),
        trusted
      )
    ).toThrow('deployed Juanie runtime');
    expect(() =>
      assertTrustedGitLabBootstrap(
        bootstrap().replace('https://juanie.example.com\n', 'https://attacker.example.com\n'),
        trusted
      )
    ).toThrow('deployed Juanie runtime');
  });
});
