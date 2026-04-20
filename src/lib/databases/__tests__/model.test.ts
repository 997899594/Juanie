import { describe, expect, it } from 'bun:test';
import {
  getDatabaseRuntime,
  inferDatabaseRuntime,
  usesCloudNativePgRuntime,
} from '@/lib/databases/model';

describe('database runtime helpers', () => {
  it('defaults standalone postgresql to cloudnativepg', () => {
    expect(inferDatabaseRuntime('postgresql', 'standalone')).toBe('cloudnativepg');
    expect(
      usesCloudNativePgRuntime({
        type: 'postgresql',
        provisionType: 'standalone',
      })
    ).toBe(true);
  });

  it('keeps shared managed databases on shared runtimes', () => {
    expect(inferDatabaseRuntime('postgresql', 'shared')).toBe('shared_postgres');
    expect(inferDatabaseRuntime('redis', 'shared')).toBe('shared_redis');
  });

  it('keeps non-operator standalone databases on native kubernetes', () => {
    expect(inferDatabaseRuntime('mysql', 'standalone')).toBe('native_k8s');
    expect(inferDatabaseRuntime('redis', 'standalone')).toBe('native_k8s');
  });

  it('treats external databases as external runtime', () => {
    expect(inferDatabaseRuntime('mongodb', 'external')).toBe('external');
    expect(inferDatabaseRuntime('postgresql', 'external')).toBe('external');
  });

  it('honors explicitly stored runtime values', () => {
    expect(
      getDatabaseRuntime({
        type: 'postgresql',
        provisionType: 'standalone',
        runtime: 'shared_postgres',
      })
    ).toBe('shared_postgres');
  });
});
