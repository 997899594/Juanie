import { describe, expect, it } from 'bun:test';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentAccessOrThrow,
  getProjectReleaseAccessOrThrow,
  getTeamAccessOrThrow,
} from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';

process.env.DATABASE_HOST ??= 'localhost';
process.env.DATABASE_PORT ??= '5432';
process.env.DATABASE_NAME ??= 'juanie';
process.env.DATABASE_USER ??= 'postgres';
process.env.DATABASE_PASSWORD ??= 'postgres';
process.env.DATABASE_SSL_MODE ??= 'disable';

describe('api access guards', () => {
  it('rejects invalid project ids before querying the database', async () => {
    let projectQueryCalled = false;
    const originalFindFirst = db.query.projects.findFirst;

    (db.query.projects as { findFirst: typeof originalFindFirst }).findFirst = (async () => {
      projectQueryCalled = true;
      return null;
    }) as unknown as typeof originalFindFirst;

    try {
      await getProjectAccessOrThrow('new', 'user-1');
      throw new Error('Expected invalid project id to throw');
    } catch (error) {
      expect(projectQueryCalled).toBe(false);
      expect(isAccessError(error)).toBe(true);
      if (isAccessError(error)) {
        expect(error.code).toBe('not_found');
        expect(error.status).toBe(404);
      }
    } finally {
      (db.query.projects as { findFirst: typeof originalFindFirst }).findFirst = originalFindFirst;
    }
  });

  it('rejects invalid team ids before querying the database', async () => {
    let teamQueryCalled = false;
    const originalFindFirst = db.query.teams.findFirst;

    (db.query.teams as { findFirst: typeof originalFindFirst }).findFirst = (async () => {
      teamQueryCalled = true;
      return null;
    }) as unknown as typeof originalFindFirst;

    try {
      await getTeamAccessOrThrow('new', 'user-1');
      throw new Error('Expected invalid team id to throw');
    } catch (error) {
      expect(teamQueryCalled).toBe(false);
      expect(isAccessError(error)).toBe(true);
      if (isAccessError(error)) {
        expect(error.code).toBe('not_found');
        expect(error.status).toBe(404);
      }
    } finally {
      (db.query.teams as { findFirst: typeof originalFindFirst }).findFirst = originalFindFirst;
    }
  });

  it('rejects invalid environment ids before querying the database', async () => {
    let environmentQueryCalled = false;
    const originalFindFirst = db.query.environments.findFirst;

    (db.query.environments as { findFirst: typeof originalFindFirst }).findFirst = (async () => {
      environmentQueryCalled = true;
      return null;
    }) as unknown as typeof originalFindFirst;

    try {
      await getProjectEnvironmentAccessOrThrow(
        '11111111-1111-1111-1111-111111111111',
        'new',
        'user-1'
      );
      throw new Error('Expected invalid environment id to throw');
    } catch (error) {
      expect(environmentQueryCalled).toBe(false);
      expect(isAccessError(error)).toBe(true);
      if (isAccessError(error)) {
        expect(error.code).toBe('not_found');
        expect(error.status).toBe(404);
      }
    } finally {
      (db.query.environments as { findFirst: typeof originalFindFirst }).findFirst =
        originalFindFirst;
    }
  });

  it('rejects invalid release ids before querying the database', async () => {
    let releaseQueryCalled = false;
    const originalFindFirst = db.query.releases.findFirst;

    (db.query.releases as { findFirst: typeof originalFindFirst }).findFirst = (async () => {
      releaseQueryCalled = true;
      return null;
    }) as unknown as typeof originalFindFirst;

    try {
      await getProjectReleaseAccessOrThrow('11111111-1111-1111-1111-111111111111', 'new', 'user-1');
      throw new Error('Expected invalid release id to throw');
    } catch (error) {
      expect(releaseQueryCalled).toBe(false);
      expect(isAccessError(error)).toBe(true);
      if (isAccessError(error)) {
        expect(error.code).toBe('not_found');
        expect(error.status).toBe(404);
      }
    } finally {
      (db.query.releases as { findFirst: typeof originalFindFirst }).findFirst = originalFindFirst;
    }
  });
});
