import { describe, expect, it } from 'bun:test';
import { databases, projects, repositories, services } from '@/lib/db/schema';
import {
  buildRunScriptCommand,
  detectMigrationTool,
  detectPackageManager,
  inferMigrationCommand,
  renderJuanieConfig,
} from '@/lib/queue/project-init';

describe('project init migration inference', () => {
  it('prefers packageManager field over lockfiles', () => {
    expect(
      detectPackageManager(['package.json', 'package-lock.json'], {
        packageManager: 'bun@1.2.0',
      })
    ).toBe('bun');
  });

  it('uses db:migrate as an auto-run migration command', () => {
    const inferred = inferMigrationCommand(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'bun.lockb'],
        packageManager: 'bun',
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
      tool: 'drizzle',
      command: 'bun run db:migrate',
      autoRun: true,
      approvalPolicy: 'manual_in_production',
    });
  });

  it('keeps db:push disabled by default', () => {
    const inferred = inferMigrationCommand(
      {
        monorepoType: 'none',
        rootFiles: ['package.json', 'pnpm-lock.yaml'],
        packageManager: 'pnpm',
        packageJson: {
          scripts: {
            'db:push': 'drizzle-kit push',
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

    expect(inferred?.command).toBe('pnpm run db:push');
    expect(inferred?.autoRun).toBe(false);
    expect(inferred?.approvalPolicy).toBe('manual_in_production');
  });

  it('falls back to custom when no known migration tool is installed', () => {
    expect(
      detectMigrationTool({
        dependencies: {
          react: '^19.0.0',
        },
      })
    ).toBe('custom');
  });

  it('renders service-level migrate blocks for a single primary relational database', () => {
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

    expect(config).toContain('migrate:');
    expect(config).toContain('tool: drizzle');
    expect(config).toContain('command: bun run db:migrate');
    expect(config).toContain('autoRun: true');
    expect(config).not.toContain('databases:\n      - role:');
  });

  it('renders a conservative fallback for monorepos', () => {
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
        packageJson: {
          scripts: {
            'db:migrate': 'turbo run db:migrate',
          },
        },
      }
    );

    expect(config).toContain("TODO: replace with the repository's real migration command");
    expect(config).toContain('command: npm run db:migrate');
    expect(config).toContain('autoRun: false');
  });

  it('builds yarn commands without run', () => {
    expect(buildRunScriptCommand('yarn', 'db:migrate')).toBe('yarn db:migrate');
  });
});
