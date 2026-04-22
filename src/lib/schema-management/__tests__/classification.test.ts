import { describe, expect, it } from 'bun:test';
import { classifySchemaLedgerState } from '@/lib/schema-management/classification';

describe('schema ledger classification', () => {
  it('marks matching ledger as aligned', () => {
    const result = classifySchemaLedgerState({
      kind: 'drizzle',
      expectedEntries: ['0001_init', '0002_add_users'],
      actualEntries: ['0001_init', '0002_add_users'],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('aligned');
    expect(result.hasLedger).toBe(true);
  });

  it('marks missing ledger with user tables as aligned_untracked', () => {
    const result = classifySchemaLedgerState({
      kind: 'drizzle',
      expectedEntries: ['0001_init'],
      actualEntries: [],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('aligned_untracked');
    expect(result.summary).toContain('Atlas diff 未发现 schema 差异');
  });

  it('marks prefix ledger as pending migrations', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: ['001_init.sql', '002_add_index.sql'],
      actualEntries: ['001_init.sql'],
      hasUserTables: true,
      driftDetected: true,
      driftSummary: '-- add index users_name_idx',
    });

    expect(result.status).toBe('pending_migrations');
    expect(result.summary).toContain('已执行 1/2 项');
    expect(result.summary).toContain('add index users_name_idx');
  });

  it('marks empty repo truth as unmanaged', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: [],
      actualEntries: [],
      hasUserTables: false,
      driftDetected: false,
    });

    expect(result.status).toBe('unmanaged');
  });

  it('marks missing ledger with drift as drifted instead of aligned_untracked', () => {
    const result = classifySchemaLedgerState({
      kind: 'atlas',
      expectedEntries: ['202604220001'],
      actualEntries: [],
      hasUserTables: true,
      driftDetected: true,
      driftSummary: '-- create table projects',
    });

    expect(result.status).toBe('drifted');
    expect(result.summary).toContain('Atlas diff 检测到 schema 差异');
  });

  it('treats ledger mismatch without live drift as aligned_untracked', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: ['001_init.sql', '002_add_index.sql'],
      actualEntries: ['001_init.sql'],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('aligned_untracked');
    expect(result.summary).toContain('账本与仓库 SQL 迁移链不一致');
  });
});
