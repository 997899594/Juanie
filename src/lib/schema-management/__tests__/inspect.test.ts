import { describe, expect, it } from 'bun:test';
import { normalizeDrizzleLedgerEntries } from '@/lib/schema-management/inspect';

describe('drizzle ledger normalization', () => {
  it('maps both migration tags and file hashes back to repo tags', () => {
    const repoFiles = [
      {
        name: '0000_known_mole_man.sql',
        content: 'create table foo(id int);',
      },
      {
        name: '0001_soft_hedge_knight.sql',
        content: 'alter table foo add column bar text;',
      },
    ];

    const normalized = normalizeDrizzleLedgerEntries({
      repoFiles,
      actualLedgerEntries: [
        '0000_known_mole_man',
        'a5319ab6f76edc1536cacea34acc6e279705f7252dd697a6a30a8ca2a4da5c6f',
      ],
    });

    expect(normalized).toEqual(['0000_known_mole_man', '0001_soft_hedge_knight']);
  });
});
