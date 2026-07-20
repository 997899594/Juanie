import { describe, expect, it } from 'bun:test';
import { buildSchemaRepairRuntimeArtifacts } from '@/lib/schema-management/review-request-helpers';

describe('schema review request helpers', () => {
  it('builds runtime-only atlas artifacts outside the repo review surface', () => {
    const artifacts = buildSchemaRepairRuntimeArtifacts({
      provider: 'github',
      tool: 'drizzle',
      databaseType: 'postgresql',
      migrationPath: 'drizzle',
      planId: 'plan-12345678',
      title: 'Schema repair',
      summary: 'Need repair',
      planKind: 'repair_pr_required',
      stateStatus: 'drifted',
      databaseName: 'postgresql',
      expectedVersion: '0001_soft_hedge_knight',
      actualVersion: '0000_known_mole_man',
      sourceConfigPath: 'apps/api/drizzle.config.ts',
      packageManager: {
        name: 'pnpm',
        version: '10.12.1',
        spec: 'pnpm@10.12.1',
        major: 10,
      },
    });

    expect(artifacts.atlasConfigPath).toBe('.juanie/schema-repair/plan-12345678.atlas.hcl');
    expect(artifacts.atlasScriptPath).toBe('.juanie/schema-repair/plan-12345678.atlas.sh');
    expect(Object.keys(artifacts.files)).toEqual([
      '.juanie/schema-repair/plan-12345678.atlas.hcl',
      '.juanie/schema-repair/plan-12345678.atlas.sh',
    ]);
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.hcl']).toContain(
      'plan-12345678.schema.sql'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.hcl']).toContain(
      '.juanie/schema-repair/generated'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'migrate diff'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'arigaio/atlas:1.2.3-community'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).not.toContain(
      'arigaio/atlas:latest'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'apps/api/drizzle.config.ts'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      '/usr/local/bin/node /app/node_modules/corepack/dist/corepack.js "pnpm@10.12.1"'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'install --frozen-lockfile'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).not.toContain(
      'npm install'
    );
  });

  it('uses exact Bun and modern Yarn launchers without lockfile guessing', () => {
    const commonInput = {
      provider: 'github' as const,
      tool: 'drizzle' as const,
      databaseType: 'postgresql' as const,
      migrationPath: 'drizzle',
      planId: 'plan-12345678',
      title: 'Schema repair',
      summary: 'Need repair',
      planKind: 'repair_pr_required' as const,
      stateStatus: 'drifted',
      databaseName: 'postgresql',
      expectedVersion: null,
      actualVersion: null,
      sourceConfigPath: 'drizzle.config.ts',
    };

    const bunScript = buildSchemaRepairRuntimeArtifacts({
      ...commonInput,
      packageManager: {
        name: 'bun',
        version: '1.3.14',
        spec: 'bun@1.3.14',
        major: 1,
      },
    }).files['.juanie/schema-repair/plan-12345678.atlas.sh'];
    const yarnScript = buildSchemaRepairRuntimeArtifacts({
      ...commonInput,
      packageManager: {
        name: 'yarn',
        version: '4.9.2',
        spec: 'yarn@4.9.2',
        major: 4,
      },
    }).files['.juanie/schema-repair/plan-12345678.atlas.sh'];

    expect(bunScript).toContain('bun x --package "bun@1.3.14" bun');
    expect(bunScript).toContain('x drizzle-kit export');
    expect(yarnScript).toContain('corepack/dist/corepack.js "yarn@4.9.2"');
    expect(yarnScript).toContain('install --immutable');
    expect(yarnScript).not.toContain('if [ -f');
  });

  it('fails closed when Drizzle repair has no validated package manager', () => {
    expect(() =>
      buildSchemaRepairRuntimeArtifacts({
        provider: 'github',
        tool: 'drizzle',
        databaseType: 'postgresql',
        migrationPath: 'drizzle',
        planId: 'plan-12345678',
        title: 'Schema repair',
        summary: 'Need repair',
        planKind: 'repair_pr_required',
        stateStatus: 'drifted',
        databaseName: 'postgresql',
        expectedVersion: null,
        actualVersion: null,
      })
    ).toThrow('requires a validated package manager contract');
  });

  it('renders repository config paths as inert shell data', () => {
    const script = buildSchemaRepairRuntimeArtifacts({
      provider: 'github',
      tool: 'drizzle',
      databaseType: 'postgresql',
      migrationPath: 'drizzle',
      planId: 'plan-12345678',
      title: 'Schema repair',
      summary: 'Need repair',
      planKind: 'repair_pr_required',
      stateStatus: 'drifted',
      databaseName: 'postgresql',
      expectedVersion: null,
      actualVersion: null,
      sourceConfigPath: "$(touch /tmp/owned)'drizzle.config.ts",
      packageManager: {
        name: 'npm',
        version: '11.4.2',
        spec: 'npm@11.4.2',
        major: 11,
      },
    }).files['.juanie/schema-repair/plan-12345678.atlas.sh'];

    expect(script).toContain(`DRIZZLE_CONFIG='$(touch /tmp/owned)'"'"'drizzle.config.ts'`);
    expect(script).toContain('corepack/dist/corepack.js "npm@11.4.2"');
    expect(script).toContain(`"${'$'}{PACKAGE_MANAGER[@]}" ci`);
  });
});
