import { describe, expect, it } from 'bun:test';
import { classifySchemaLedgerState } from '@/lib/schema-management/classification';

describe('schema ledger classification', () => {
  it('marks matching ledger as aligned', () => {
    const result = classifySchemaLedgerState({
      kind: 'drizzle',
      expectedEntries: ['0001_init', '0002_add_users'],
      actualEntries: ['0001_init', '0002_add_users'],
      hasUserTables: true,
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
    });

    expect(result.status).toBe('aligned_untracked');
    expect(result.summary).toContain('缺少 Drizzle 迁移账本');
  });

  it('marks prefix ledger as drifted', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: ['001_init.sql', '002_add_index.sql'],
      actualEntries: ['001_init.sql'],
      hasUserTables: true,
    });

    expect(result.status).toBe('drifted');
    expect(result.summary).toContain('已执行 1/2 项');
  });

  it('marks empty repo truth as unmanaged', () => {
    const result = classifySchemaLedgerState({
      kind: 'sql',
      expectedEntries: [],
      actualEntries: [],
      hasUserTables: false,
    });

    expect(result.status).toBe('unmanaged');
  });
});
