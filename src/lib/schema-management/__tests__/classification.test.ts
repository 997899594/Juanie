import { describe, expect, it } from 'bun:test';
import { classifySchemaLedgerState } from '@/lib/schema-management/classification';

describe('schema ledger classification', () => {
  it('admits a tracked Atlas baseline for an existing database', () => {
    const result = classifySchemaLedgerState({
      kind: 'atlas',
      expectedEntries: ['2026071400', '2026071401'],
      actualEntries: [],
      hasUserTables: true,
      driftDetected: true,
      baselineVersion: '2026071400',
    });

    expect(result.status).toBe('pending_migrations');
    expect(result.summary).toContain('2026071400');
  });

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

  it('marks prefix ledger as pending when the remaining migration has no schema diff', () => {
    const result = classifySchemaLedgerState({
      kind: 'atlas',
      expectedEntries: ['20260715076000', '20260715077000'],
      actualEntries: ['20260715076000'],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('pending_migrations');
    expect(result.summary).toContain('已执行 1/2 项');
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

  it('treats desired schema without drift as aligned', () => {
    const result = classifySchemaLedgerState({
      kind: 'desired_schema',
      expectedEntries: ['a1b2c3d4'],
      actualEntries: ['a1b2c3d4'],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('aligned');
    expect(result.hasLedger).toBe(false);
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

  it('marks live drift as drifted when the migration ledger is aligned', () => {
    const result = classifySchemaLedgerState({
      kind: 'atlas',
      expectedEntries: ['20260715076000'],
      actualEntries: ['20260715076000'],
      hasUserTables: true,
      driftDetected: true,
      driftSummary: '-- unexpected schema change',
    });

    expect(result.status).toBe('drifted');
    expect(result.summary).toContain('账本与仓库 Atlas 迁移链一致');
    expect(result.summary).toContain('unexpected schema change');
  });

  it('treats ledger mismatch without live drift as aligned_untracked', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: ['001_init.sql', '002_add_index.sql'],
      actualEntries: ['001_init.sql', '003_manual.sql'],
      hasUserTables: true,
      driftDetected: false,
    });

    expect(result.status).toBe('aligned_untracked');
    expect(result.summary).toContain('账本与仓库 SQL 迁移链不一致');
  });
});
