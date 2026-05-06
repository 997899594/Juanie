import { describe, expect, it } from 'bun:test';
import {
  detectMonorepoType,
  getMonorepoBuildCommand,
  getMonorepoInstallCommand,
} from '@/lib/monorepo';

describe('monorepo detection', () => {
  it('detects turborepo only when turbo.json exists', () => {
    expect(detectMonorepoType(['package.json', 'turbo.json', 'apps/web/package.json'])).toBe(
      'turborepo'
    );
  });

  it('treats unsupported workspace layouts as single-repo projects', () => {
    expect(detectMonorepoType(['package.json', 'pnpm-workspace.yaml'])).toBe('none');
    expect(detectMonorepoType(['package.json', 'nx.json'])).toBe('none');
    expect(detectMonorepoType(['package.json', 'apps/web/package.json'])).toBe('none');
  });

  it('keeps Turborepo-specific build and install commands', () => {
    expect(getMonorepoBuildCommand('turborepo', 'web')).toBe('turbo run build --filter=web');
    expect(getMonorepoInstallCommand('turborepo')).toBe('pnpm install');
  });
});
