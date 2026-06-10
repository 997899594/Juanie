import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { databaseMigrations } from '@/lib/db/schema';
import {
  listRepositoryDirectoryFromRepoPath,
  readRepositoryFileFromRepoPath,
} from '@/lib/migrations/fetch';
import { resolveMigrationPath } from '@/lib/migrations/path';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';

/**
 * Fast pre-flight check that determines whether a migration run is POTENTIALLY needed
 * for a given spec at a given commit, WITHOUT connecting to the database or running
 * heavy export/diff commands.
 *
 * This is designed to run in the release orchestration phase (BullMQ release queue)
 * where job stalls at ~30s timeout. It yields false positives (worker verifies via
 * full Atlas diff), but eliminates false negatives when no source files changed.
 */
export async function hasPotentialSchemaChanges(
  spec: ResolvedMigrationSpec,
  currentCommitSha: string,
  previousCommitSha?: string | null
): Promise<boolean> {
  const tool = spec.specification.tool;
  const migrationPath = resolveMigrationPath(spec.specification, spec.database.type);

  // SQL / Atlas tools: compare migration directory listings between commits
  if (tool === 'sql' || tool === 'atlas') {
    if (!previousCommitSha) return migrationPath !== null;
    if (!migrationPath) return false;

    const [prevFiles, currFiles] = await Promise.all([
      listRepositoryDirectoryFromRepoPath(
        spec.specification.projectId,
        migrationPath,
        previousCommitSha
      ),
      listRepositoryDirectoryFromRepoPath(
        spec.specification.projectId,
        migrationPath,
        currentCommitSha
      ),
    ]);

    if (prevFiles.length !== currFiles.length) return true;

    const prevNames = new Set(prevFiles.map((f) => f.name));
    if (!currFiles.every((f) => prevNames.has(f.name))) return true;

    // File lists match — verify via databaseMigrations whether all are already executed
    const executedMigrations = await db.query.databaseMigrations.findMany({
      where: and(
        eq(databaseMigrations.databaseId, spec.database.id),
        eq(databaseMigrations.status, 'success')
      ),
    });
    const executedNames = new Set(executedMigrations.map((m) => m.filename));
    if (currFiles.every((f) => executedNames.has(f.name))) return false;

    return true;
  }

  // Drizzle: check if the config file and schema source files changed between commits.
  // Without a previous commit, we assume potentially changed.
  if (tool === 'drizzle') {
    if (!previousCommitSha) return true;

    const configPath = spec.specification.sourceConfigPath?.trim();
    if (!configPath) return true; // Auto-discovered config — assume potential changes

    try {
      const [prevContent, currContent] = await Promise.all([
        readRepositoryFileFromRepoPath(spec.specification.projectId, configPath, previousCommitSha),
        readRepositoryFileFromRepoPath(spec.specification.projectId, configPath, currentCommitSha),
      ]);

      if (!prevContent || !currContent) return true;
      if (prevContent !== currContent) return true;

      // Config file unchanged. Extract schema path from config to check source files.
      const schemaPath = extractDrizzleSchemaPath(currContent);
      if (!schemaPath) return true; // Can't determine schema path, assume changes

      const schemaDir = schemaPath.split('/').slice(0, -1).join('/') || '.';
      const [prevSchemaFiles, currSchemaFiles] = await Promise.all([
        listRepositoryDirectoryFromRepoPath(
          spec.specification.projectId,
          schemaDir,
          previousCommitSha
        ),
        listRepositoryDirectoryFromRepoPath(
          spec.specification.projectId,
          schemaDir,
          currentCommitSha
        ),
      ]);

      const prevFileNames = new Set(prevSchemaFiles.map((f) => f.name));
      return !currSchemaFiles.every((f) => prevFileNames.has(f.name));
    } catch {
      return true; // Any error → assume potential changes, worker will verify
    }
  }

  // Prisma, Knex, TypeORM, custom tools — assume changes
  return true;
}

/**
 * Extract the Drizzle schema file path from config content using regex.
 * Handles TS/JS/JSON configs: both `schema: './src/db/schema.ts'` and `schema: ['./a.ts', './b.ts']`.
 * Returns the first path or the directory of the first file.
 */
function extractDrizzleSchemaPath(configContent: string): string | null {
  // Match schema: 'path' or schema: "path"
  const singleMatch = configContent.match(/schema\s*:\s*['"]([^'"]+)['"]/);
  if (singleMatch) return singleMatch[1]!;

  // Match schema: ['path', ...] — grab first element
  const arrayMatch = configContent.match(/schema\s*:\s*\[\s*['"]([^'"]+)['"]/);
  if (arrayMatch) return arrayMatch[1]!;

  return null;
}
