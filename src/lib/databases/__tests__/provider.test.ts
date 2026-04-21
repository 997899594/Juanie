import { describe, expect, it } from 'bun:test';
import { resolveManagedDatabaseProvider } from '@/lib/databases/provider';

describe('managed database provider resolution', () => {
  it('routes standalone postgresql to the cloudnativepg provider', () => {
    expect(
      resolveManagedDatabaseProvider({
        type: 'postgresql',
        provisionType: 'standalone',
      }).id
    ).toBe('cloudnativepg');
  });

  it('routes shared postgresql and redis to their dedicated shared providers', () => {
    expect(
      resolveManagedDatabaseProvider({
        type: 'postgresql',
        provisionType: 'shared',
      }).id
    ).toBe('shared_postgres');
    expect(
      resolveManagedDatabaseProvider({
        type: 'redis',
        provisionType: 'shared',
      }).id
    ).toBe('shared_redis');
  });

  it('routes external databases to the external passthrough provider', () => {
    expect(
      resolveManagedDatabaseProvider({
        type: 'mongodb',
        provisionType: 'external',
      }).id
    ).toBe('external');
  });
});
