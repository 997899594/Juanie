import { describe, expect, it } from 'bun:test';
import {
  assertProjectScope,
  canDownloadReleaseArtifact,
  canExecInEnvironment,
  canManageConfigObjects,
  canReadProjectRuntime,
  canViewProjectDelivery,
} from '@/lib/policies/runtime-access';

describe('runtime access policy', () => {
  it('allows members to read runtime state', () => {
    expect(canReadProjectRuntime('member')).toBe(true);
  });

  it('allows delivery users to view delivery without runtime access', () => {
    expect(canViewProjectDelivery('delivery')).toBe(true);
    expect(canReadProjectRuntime('delivery')).toBe(false);
  });

  it('blocks members from exec in production and non-production by default', () => {
    expect(canExecInEnvironment('member', { isProduction: false })).toBe(false);
    expect(canExecInEnvironment('member', { isProduction: true })).toBe(false);
  });

  it('allows only owner/admin to mutate config objects', () => {
    expect(canManageConfigObjects('owner')).toBe(true);
    expect(canManageConfigObjects('admin')).toBe(true);
    expect(canManageConfigObjects('member')).toBe(false);
    expect(canManageConfigObjects('delivery')).toBe(false);
  });

  it('limits delivery users to customer artifacts', () => {
    expect(
      canDownloadReleaseArtifact('delivery', {
        kind: 'package',
        uri: 's3://artifacts/app.tgz',
      })
    ).toBe(true);
    expect(
      canDownloadReleaseArtifact('delivery', {
        kind: 'image',
        serviceId: 'svc-1',
        imageUrl: 'ghcr.io/demo/app:1',
      })
    ).toBe(false);
    expect(
      canDownloadReleaseArtifact('member', {
        kind: 'image',
        serviceId: 'svc-1',
        imageUrl: 'ghcr.io/demo/app:1',
      })
    ).toBe(true);
  });

  it('rejects mismatched project scope', () => {
    expect(() => assertProjectScope('project-a', 'project-b')).toThrow('invalid_scope');
  });
});
