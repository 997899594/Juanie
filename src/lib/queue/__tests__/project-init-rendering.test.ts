import { describe, expect, it } from 'bun:test';
import { databases, projects, repositories, services } from '@/lib/db/schema';
import {
  buildRunScriptCommand,
  detectMigrationTool,
  detectPackageManager,
  inferSchemaConfig,
  renderJuanieConfig,
  resolvePackageScriptCommand,
} from '@/lib/queue/project-init';

describe('project init migration inference', () => {
  it('prefers packageManager field over lockfiles', () => {
    expect(
      detectPackageManager(['package.json', 'package-lock.json'], {
        packageManager: 'bun@1.2.0',
      })
    ).toBe('bun');
  });

  it('uses db:migrate as an auto-run schema config', () => {
    const inferred = inferSchemaConfig(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'bun.lockb'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            'db:migrate': 'drizzle-kit migrate',
          },
          dependencies: {
            'drizzle-orm': '^0.1.0',
          },
          devDependencies: {
            'drizzle-kit': '^0.1.0',
          },
        },
      },
      'postgresql'
    );

    expect(inferred).toEqual({
      comment: 'Auto-generated from package.json script db:migrate',
      source: 'drizzle',
      executionMode: 'automatic',
      approvalPolicy: 'manual_in_production',
    });
  });

  it('prefers drizzle when atlas.hcl is only a sidecar file beside db:migrate wrappers', () => {
    const inferred = inferSchemaConfig(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'atlas.hcl', 'bun.lockb'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: 'atlas.hcl',
        atlasConfigContent: 'env "local" { src = "file://db/atlas/schema.sql" }',
        atlasSchemaContents: {
          'db/atlas/schema.sql': 'create table notes (id uuid primary key);',
        },
        migrationScriptContents: {
          'scripts/db-migrate.mjs': 'ensurePgvector(); drizzle-kit migrate',
        },
        packageJson: {
          scripts: {
            'db:migrate': 'node scripts/db-migrate.mjs',
          },
          dependencies: {
            'drizzle-orm': '^0.1.0',
          },
          devDependencies: {
            'drizzle-kit': '^0.1.0',
          },
        },
      },
      'postgresql'
    );

    expect(inferred).toEqual({
      comment: 'Auto-generated from package.json script db:migrate',
      source: 'drizzle',
      executionMode: 'automatic',
      approvalPolicy: 'manual_in_production',
    });
  });

  it('falls back to atlas when no stronger migration signal exists', () => {
    const inferred = inferSchemaConfig(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'atlas.hcl'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: 'atlas.hcl',
        atlasConfigContent: 'env "local" { src = "file://migrations" }',
        atlasSchemaContents: {},
        migrationScriptContents: {},
        packageJson: {
          scripts: {},
        },
      },
      'postgresql'
    );

    expect(inferred).toEqual({
      comment: 'Auto-detected from atlas.hcl',
      source: 'atlas',
      config: 'atlas.hcl',
      executionMode: 'automatic',
      approvalPolicy: 'manual_in_production',
    });
  });

  it('returns null when only unsupported migration scripts exist', () => {
    const inferred = inferSchemaConfig(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'pnpm-lock.yaml'],
        packageManager: 'pnpm',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            'db:sync': 'drizzle-kit sync',
          },
          dependencies: {
            'drizzle-orm': '^0.1.0',
          },
          devDependencies: {
            'drizzle-kit': '^0.1.0',
          },
        },
      },
      'postgresql'
    );

    expect(inferred).toBe(null);
  });

  it('falls back to custom when no known migration tool is installed', () => {
    expect(
      detectMigrationTool({
        packageJson: {
          dependencies: {
            react: '^19.0.0',
          },
        },
        rootFiles: [],
        atlasConfigContent: null,
        migrationScriptContents: {},
      })
    ).toBe('custom');
  });

  it('keeps unsupported schema sources in external mode', () => {
    const inferred = inferSchemaConfig(
      {
        monorepoType: 'none',
        rootFiles: ['package.json'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            'db:migrate': 'prisma migrate deploy',
          },
          dependencies: {
            prisma: '^6.0.0',
          },
        },
      },
      'postgresql'
    );

    expect(inferred).toEqual({
      comment:
        'Auto-detected from package.json script db:migrate; platform keeps this schema source in external mode',
      source: 'prisma',
      config: 'prisma/schema.prisma',
      executionMode: 'external',
    });
  });

  it('renders service-level schema blocks for a single primary relational database', () => {
    const config = renderJuanieConfig(
      {
        id: 'project_1',
        slug: 'nexusnote',
        name: 'NexusNote',
        productionBranch: 'main',
        repositoryId: 'repo_1',
      } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
      {
        services: [
          {
            id: 'service_web',
            projectId: 'project_1',
            name: 'web',
            type: 'web',
            buildCommand: 'bun run build',
            startCommand: 'bun run start',
            port: 3000,
          } as typeof services.$inferSelect,
        ],
        databases: [
          {
            id: 'db_primary',
            projectId: 'project_1',
            environmentId: 'env_prod',
            serviceId: 'service_web',
            name: 'primary',
            type: 'postgresql',
            role: 'primary',
            scope: 'service',
            plan: 'starter',
          } as typeof databases.$inferSelect,
        ],
      },
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'bun.lockb'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            'db:migrate': 'drizzle-kit migrate',
          },
          dependencies: {
            'drizzle-orm': '^0.1.0',
          },
          devDependencies: {
            'drizzle-kit': '^0.1.0',
          },
        },
      }
    );

    expect(config).toContain('schema:');
    expect(config).toContain('source: drizzle');
    expect(config).toContain('executionMode: automatic');
    expect(config).not.toContain('databases:\n      - role:');
  });

  it('renders inferred postgres capabilities from atlas and migration inspection', () => {
    const config = renderJuanieConfig(
      {
        id: 'project_1',
        slug: 'nexusnote',
        name: 'NexusNote',
        productionBranch: 'main',
        repositoryId: 'repo_1',
      } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
      {
        services: [
          {
            id: 'service_web',
            projectId: 'project_1',
            name: 'web',
            type: 'web',
            buildCommand: 'bun run build',
            startCommand: 'bun run start',
            port: 3000,
          } as typeof services.$inferSelect,
        ],
        databases: [
          {
            id: 'db_primary',
            projectId: 'project_1',
            environmentId: 'env_prod',
            serviceId: 'service_web',
            name: 'primary',
            type: 'postgresql',
            role: 'primary',
            scope: 'service',
            plan: 'starter',
            capabilities: [],
          } as unknown as typeof databases.$inferSelect,
        ],
      },
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'atlas.hcl'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: 'atlas.hcl',
        atlasConfigContent: 'env "local" { src = "file://db/atlas/schema.sql" }',
        atlasSchemaContents: {
          'db/atlas/schema.sql':
            'create extension if not exists vector; create table chunks (embedding vector(1536));',
        },
        migrationScriptContents: {
          'scripts/db-migrate.mjs': 'ensurePgvector(connectionString);',
        },
        packageJson: {
          scripts: {
            'db:migrate': 'node scripts/db-migrate.mjs',
          },
        },
      }
    );

    expect(config).toContain('source: atlas');
    expect(config).toContain('capabilities:');
    expect(config).toContain('- vector');
  });

  it('renders a manual migration note for monorepos without inventing commands', () => {
    const config = renderJuanieConfig(
      {
        id: 'project_1',
        slug: 'nexusnote',
        name: 'NexusNote',
        productionBranch: 'main',
        repositoryId: 'repo_1',
      } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
      {
        services: [
          {
            id: 'service_web',
            projectId: 'project_1',
            name: 'web',
            type: 'web',
            buildCommand: 'bun run build',
            startCommand: 'bun run start',
            port: 3000,
          } as typeof services.$inferSelect,
        ],
        databases: [
          {
            id: 'db_primary',
            projectId: 'project_1',
            environmentId: 'env_prod',
            serviceId: 'service_web',
            name: 'primary',
            type: 'postgresql',
            role: 'primary',
            scope: 'service',
            plan: 'starter',
          } as typeof databases.$inferSelect,
        ],
      },
      {
        monorepoType: 'turborepo',
        rootFiles: ['package.json', 'turbo.json'],
        packageManager: 'bun',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            'db:migrate': 'turbo run db:migrate',
          },
        },
      }
    );

    expect(config).toContain('Juanie could not infer a tracked schema source for this service.');
    expect(config).toContain(
      'Add schema.source manually; the app keeps its own migration truth, and Juanie uses Atlas for diff / repair workflows.'
    );
    expect(config).not.toContain('command: npm run db:migrate');
    expect(config).not.toContain('executionMode: manual_platform');
    expect(config).not.toContain('migrate:');
  });

  it('builds yarn commands without run', () => {
    expect(buildRunScriptCommand('yarn', 'db:migrate')).toBe('yarn db:migrate');
  });

  it('prefers declared package scripts over synthesized package-manager wrappers', () => {
    expect(
      resolvePackageScriptCommand(
        {
          scripts: {
            'db:migrate': 'node scripts/db-migrate.mjs',
          },
        },
        'bun',
        'db:migrate'
      )
    ).toBe('node scripts/db-migrate.mjs');
  });
});
