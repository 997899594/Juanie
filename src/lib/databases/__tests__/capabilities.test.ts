import { describe, expect, it } from 'bun:test';
import { inferDatabaseCapabilitiesFromText } from '@/lib/databases/capabilities';

describe('database capabilities', () => {
  it('infers vector capability from migration content', () => {
    expect(
      inferDatabaseCapabilitiesFromText(`
        CREATE TABLE knowledge_evidence_chunks (
          embedding vector(4000)
        );
      `)
    ).toEqual(['vector']);
  });

  it('merges inferred capabilities with declared ones', () => {
    expect(
      inferDatabaseCapabilitiesFromText(
        `
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
          CREATE INDEX notes_title_trgm_idx
            ON notes
            USING gin (title gin_trgm_ops);
        `,
        ['vector']
      )
    ).toEqual(['pg_trgm', 'vector']);
  });
});
