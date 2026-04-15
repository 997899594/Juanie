import { describe, expect, it } from 'bun:test';
import {
  buildNormalizedPostgresUrl,
  getDatabaseUrlComponentsFromEnv,
  getNormalizedDatabaseUrlFromEnv,
  normalizeDatabaseUrl,
} from '@/lib/db/connection-url';

const ORIGINAL_ENV = { ...process.env };

function resetDatabaseEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_HOST;
  delete process.env.DATABASE_PORT;
  delete process.env.DATABASE_NAME;
  delete process.env.DATABASE_USER;
  delete process.env.DATABASE_PASSWORD;
  delete process.env.DATABASE_SSL_MODE;
  delete process.env.PGSSLMODE;
  delete process.env.POSTGRES_DB;
  delete process.env.POSTGRES_USER;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.POSTGRES_PORT;
}

describe('database connection url resolution', () => {
  it('adds sslmode from env when normalizing a postgres url', () => {
    resetDatabaseEnv();
    process.env.DATABASE_SSL_MODE = 'disable';

    expect(normalizeDatabaseUrl('postgresql://postgres:secret@postgres:5432/juanie')).toBe(
      'postgresql://postgres:secret@postgres:5432/juanie?sslmode=disable'
    );
  });

  it('builds a normalized postgres url from database components', () => {
    resetDatabaseEnv();
    process.env.DATABASE_HOST = 'postgres';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'juanie';
    process.env.DATABASE_USER = 'postgres';
    process.env.DATABASE_PASSWORD = 'secret';
    process.env.DATABASE_SSL_MODE = 'disable';

    expect(getDatabaseUrlComponentsFromEnv()).toEqual({
      host: 'postgres',
      port: 5432,
      databaseName: 'juanie',
      username: 'postgres',
      password: 'secret',
    });

    expect(getNormalizedDatabaseUrlFromEnv()).toBe(
      'postgresql://postgres:secret@postgres:5432/juanie?sslmode=disable'
    );
  });

  it('prefers component-based config over a stale raw url env', () => {
    resetDatabaseEnv();
    process.env.DATABASE_HOST = 'postgres';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'juanie';
    process.env.DATABASE_USER = 'postgres';
    process.env.DATABASE_PASSWORD = 'secret';
    process.env.DATABASE_SSL_MODE = 'disable';

    expect(getNormalizedDatabaseUrlFromEnv()).toBe(
      'postgresql://postgres:secret@postgres:5432/juanie?sslmode=disable'
    );
  });

  it('throws when component config is incomplete', () => {
    resetDatabaseEnv();
    process.env.DATABASE_HOST = 'postgres';
    process.env.DATABASE_NAME = 'juanie';

    expect(() => getNormalizedDatabaseUrlFromEnv()).toThrow(
      'DATABASE_HOST, DATABASE_NAME, DATABASE_USER, and DATABASE_PASSWORD are required'
    );
  });

  it('supports shared postgres-style env names', () => {
    resetDatabaseEnv();
    process.env.DATABASE_HOST = 'postgres';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'juanie';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_PASSWORD = 'secret';
    process.env.PGSSLMODE = 'disable';

    expect(getNormalizedDatabaseUrlFromEnv()).toBe(
      'postgresql://postgres:secret@postgres:5432/juanie?sslmode=disable'
    );
  });

  it('buildNormalizedPostgresUrl keeps normalization logic centralized', () => {
    resetDatabaseEnv();
    process.env.DATABASE_SSL_MODE = 'disable';

    expect(
      buildNormalizedPostgresUrl({
        username: 'postgres',
        password: 'secret',
        host: 'postgres',
        port: 5432,
        databaseName: 'juanie',
      })
    ).toBe('postgresql://postgres:secret@postgres:5432/juanie?sslmode=disable');
  });
});
