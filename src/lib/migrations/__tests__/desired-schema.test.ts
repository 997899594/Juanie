import { describe, expect, it } from 'bun:test';
import {
  resolveDrizzleExportOptionsFromConfig,
  validateDesiredSchemaSqlOutput,
} from '@/lib/migrations/desired-schema';
import { parseStaticDrizzleConfig } from '@/lib/migrations/drizzle-config-parser';

describe('desired schema export helpers', () => {
  it('parses static TypeScript config without executing repository code', () => {
    expect(
      parseStaticDrizzleConfig(
        `
          import { defineConfig } from 'drizzle-kit';
          const dialect = 'postgresql';
          export default defineConfig({
            dialect,
            schema: ['./src/db/schema.ts', './src/auth/schema.ts'],
            dbCredentials: { url: process.env.DATABASE_URL },
          });
        `,
        'drizzle.config.ts'
      )
    ).toEqual({
      dialect: 'postgresql',
      schema: ['./src/db/schema.ts', './src/auth/schema.ts'],
    });
  });

  it('rejects dynamic schema paths instead of executing config expressions', () => {
    expect(() =>
      parseStaticDrizzleConfig(
        `export default { dialect: 'postgresql', schema: process.env.SCHEMA_PATH };`,
        'drizzle.config.ts'
      )
    ).toThrow(/static string literals/);
  });

  it('uses schema and dialect from drizzle config without db credentials', () => {
    expect(
      resolveDrizzleExportOptionsFromConfig({
        dialect: 'postgresql',
        schema: './db/schema.ts',
        dbCredentials: {
          url: 'postgresql://example',
        },
      })
    ).toEqual({
      dialect: 'postgresql',
      schema: './db/schema.ts',
    });
  });

  it('rejects interactive drizzle output instead of treating it as schema sql', () => {
    expect(() =>
      validateDesiredSchemaSqlOutput(`
Reading config file '/tmp/repo/drizzle.config.mjs'
Using 'postgres' driver for database querying
[✓] Pulling schema from database...
error: Interactive prompts require a TTY terminal
`)
    ).toThrow(/交互式提示/);
  });

  it('accepts real drizzle schema export sql', () => {
    expect(
      validateDesiredSchemaSqlOutput(`
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
`)
    ).toContain('CREATE TABLE "users"');
  });

  it('keeps database capabilities outside desired schema sql', () => {
    expect(
      validateDesiredSchemaSqlOutput(
        'CREATE TABLE chunks (embedding vector(1536));\nCREATE INDEX chunks_trgm_idx ON chunks USING gin (content gin_trgm_ops);'
      )
    ).not.toContain('CREATE EXTENSION');
  });
});
