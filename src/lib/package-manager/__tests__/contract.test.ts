import { describe, expect, it } from 'bun:test';
import {
  PackageManagerContractError,
  parsePinnedPackageManager,
  resolvePackageManagerContract,
} from '@/lib/package-manager/contract';

describe('package manager execution contract', () => {
  it('parses exact package manager versions and Corepack integrity hashes', () => {
    expect(parsePinnedPackageManager('pnpm@10.12.1')).toEqual({
      name: 'pnpm',
      version: '10.12.1',
      spec: 'pnpm@10.12.1',
      major: 10,
    });
    expect(
      parsePinnedPackageManager(
        'yarn@4.9.2+sha224.0123456789abcdef0123456789abcdef0123456789abcdef01234567'
      ).name
    ).toBe('yarn');
  });

  it('rejects missing, ranged, or tagged package manager declarations', () => {
    for (const value of [undefined, 'pnpm', 'pnpm@^10.0.0', 'yarn@latest']) {
      expect(() => parsePinnedPackageManager(value)).toThrow(PackageManagerContractError);
    }
  });

  it('requires the declared package manager lockfile', () => {
    expect(resolvePackageManagerContract('npm@11.4.2', ['package-lock.json']).name).toBe('npm');
    expect(() => resolvePackageManagerContract('pnpm@10.12.1', ['package-lock.json'])).toThrow(
      'pnpm@10.12.1 requires one of: pnpm-lock.yaml'
    );
  });

  it('rejects ambiguous repositories with multiple package-manager lockfiles', () => {
    expect(() =>
      resolvePackageManagerContract('bun@1.3.14', ['bun.lock', 'package-lock.json'])
    ).toThrow('Repository must contain exactly one package-manager lockfile');
  });
});
