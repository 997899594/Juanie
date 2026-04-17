import { describe, expect, it } from 'bun:test';
import type { HostnameAllocatorStore } from '@/lib/domains/managed';
import {
  allocateManagedHostnameBase,
  buildManagedEnvironmentHostname,
  resolveProjectManagedHostnameBase,
} from '@/lib/domains/managed';

describe('managed domain helpers', () => {
  it('prefers the stored managed hostname base', () => {
    expect(
      resolveProjectManagedHostnameBase({
        slug: 'nexusnote-8f3s2a',
        configJson: {
          routing: {
            vanitySlug: 'nexusnote',
            managedHostnameBase: 'nexusnote-k9q2',
          },
        },
      })
    ).toBe('nexusnote-k9q2');
  });

  it('falls back to the vanity slug and then internal slug', () => {
    expect(
      resolveProjectManagedHostnameBase({
        slug: 'nexusnote-8f3s2a',
        configJson: {
          routing: {
            vanitySlug: 'nexusnote',
          },
        },
      })
    ).toBe('nexusnote');

    expect(
      resolveProjectManagedHostnameBase({
        slug: 'nexusnote-8f3s2a',
      })
    ).toBe('nexusnote-8f3s2a');
  });

  it('builds readable hostnames for production and long-lived environments', () => {
    expect(
      buildManagedEnvironmentHostname('nexusnote', {
        name: 'production',
        kind: 'production',
      })
    ).toBe('nexusnote.juanie.art');

    expect(
      buildManagedEnvironmentHostname('nexusnote', {
        name: 'staging',
        kind: 'persistent',
      })
    ).toBe('nexusnote-staging.juanie.art');

    expect(
      buildManagedEnvironmentHostname('nexusnote-k9q2', {
        name: 'preview-pr-42',
        kind: 'preview',
      })
    ).toBe('nexusnote-k9q2-preview-pr-42.juanie.art');
  });

  it('keeps the clean managed hostname base when it is available', async () => {
    const lockedKeys: string[] = [];
    const store: HostnameAllocatorStore = {
      exists: async () => false,
      lock: async (lockKey) => {
        lockedKeys.push(lockKey);
      },
    };

    const allocated = await allocateManagedHostnameBase({
      preferredSlug: 'nexusnote',
      store,
    });

    expect(allocated).toBe('nexusnote');
    expect(lockedKeys).toEqual(['nexusnote.juanie.art']);
  });

  it('falls back to a suffixed managed hostname base when the clean one is taken', async () => {
    const existing = new Set(['nexusnote.juanie.art', 'nexusnote-ab12.juanie.art']);
    const suffixes = ['ab12', 'xy34'];
    const store: HostnameAllocatorStore = {
      exists: async (hostname) => existing.has(hostname),
      lock: async () => undefined,
    };

    const allocated = await allocateManagedHostnameBase({
      preferredSlug: 'nexusnote',
      store,
      createSuffix: () => suffixes.shift() ?? 'zzzz',
    });

    expect(allocated).toBe('nexusnote-xy34');
  });
});
