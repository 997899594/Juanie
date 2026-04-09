import { describe, expect, it } from 'bun:test';
import {
  assertProjectScope,
  canExecInEnvironment,
  canManageConfigObjects,
  canReadProjectRuntime,
} from '@/lib/policies/runtime-access';

describe('runtime access policy', () => {
  it('allows members to read runtime state', () => {
    expect(canReadProjectRuntime('member')).toBe(true);
  });

  it('blocks members from exec in production and non-production by default', () => {
    expect(canExecInEnvironment('member', { isProduction: false })).toBe(false);
    expect(canExecInEnvironment('member', { isProduction: true })).toBe(false);
  });

  it('allows only owner/admin to mutate config objects', () => {
    expect(canManageConfigObjects('owner')).toBe(true);
    expect(canManageConfigObjects('admin')).toBe(true);
    expect(canManageConfigObjects('member')).toBe(false);
  });

  it('rejects mismatched project scope', () => {
    expect(() => assertProjectScope('project-a', 'project-b')).toThrow('invalid_scope');
  });
});
