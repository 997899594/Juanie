import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { databases, projects, repositories, services } from '@/lib/db/schema';
import {
  buildMonorepoCiDeliverables,
  buildMonorepoCiServices,
  buildRunScriptCommand,
  detectMigrationTool,
  detectPackageManager,
  encodeMonorepoAffectedRules,
  encodeMonorepoCiDeliverables,
  inferSchemaConfig,
  renderGitHubCI,
  renderGitHubCIMonorepo,
  renderGitLabCI,
  renderGitLabCIMonorepo,
  renderJuanieConfig,
  resolvePackageScriptCommand,
  selectMonorepoCiWork,
} from '@/lib/projects/bootstrap/repository-automation';

describe('project init migration inference', () => {
  it('renders generated CI through build-run aggregation instead of per-service releases', () => {
    const project = {
      id: 'project_1',
      slug: 'nexusnote',
      name: 'NexusNote',
      productionBranch: 'main',
      repositoryId: 'repo_1',
      repository: null,
      configJson: {
        services: {
          web: {
            build: {
              strategy: 'bake',
              definition: 'docker-bake.hcl',
              target: 'web',
            },
          },
        },
      },
    } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null };
    const context = {
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
      databases: [],
    };
    const rendered = [
      renderGitHubCI(project, context),
      renderGitLabCI(project, context),
      renderGitHubCIMonorepo(project, context.services),
      renderGitLabCIMonorepo(project, context.services),
    ];

    const githubRendered = [rendered[0], rendered[2]];

    for (const ci of rendered) {
      expect(ci).toContain('.juanie/build-run.sh');
      expect(ci).not.toContain('-X POST "https://juanie.art/api/releases"');
      expect(ci).not.toContain('/api/releases/lookup');
      expect(ci).not.toContain('Trigger Juanie Release');
    }

    for (const ci of githubRendered) {
      const githubRunIdExpression = '$' + '{{ github.run_id }}';
      const githubRunAttemptExpression = '$' + '{{ github.run_attempt }}';
      expect(ci).toContain('actions/checkout@v4');
      expect(ci).toContain('docker/setup-buildx-action@v3');
      expect(ci).toContain('docker/login-action@v3');
      expect(ci).toContain(
        `JUANIE_EXTERNAL_RUN_ID: ${githubRunIdExpression}-${githubRunAttemptExpression}`
      );
      expect(ci).toContain('id-token: write');
      expect(ci).not.toContain('JUANIE_TOKEN:');
      expect(ci).not.toContain('actions/checkout@v5');
      expect(ci).not.toContain('docker/setup-buildx-action@v4');
      expect(ci).not.toContain('docker/login-action@v4');
    }

    const buildRunScript = readFileSync(
      join(process.cwd(), 'templates', 'ci', 'build-run.sh'),
      'utf-8'
    );
    expect(buildRunScript).toContain('/api/build-runs');
    expect(buildRunScript).not.toContain('secret-access-token');
  });

  it('prefers packageManager field over lockfiles', () => {
    expect(
      detectPackageManager(['package.json', 'package-lock.json'], {
        packageManager: 'bun@1.2.0',
      })
    ).toBe('bun');
  });

  it('uses db:push as the preferred auto-run schema config', () => {
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
            'db:push': 'drizzle-kit push --config drizzle.config.mjs',
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
      comment: 'Auto-generated from package.json script db:push',
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
            'db:push': 'drizzle-kit push --config drizzle.config.mjs',
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
            'db:push': 'node scripts/db-migrate.mjs',
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

  it('keeps bake targets when rendering Turborepo service builds', () => {
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
        databases: [],
      },
      {
        monorepoType: 'turborepo',
        rootFiles: ['package.json', 'turbo.json', 'docker-bake.hcl'],
        packageManager: 'bun',
        bakeDefinition: 'docker-bake.hcl',
        bakeTargets: ['web'],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: {
          scripts: {
            build: 'turbo run build',
          },
        },
      }
    );

    expect(config).toContain('strategy: bake');
    expect(config).toContain('definition: docker-bake.hcl');
    expect(config).toContain('target: web');
  });

  it('renders monorepo appDir from persisted project service topology', () => {
    const config = renderJuanieConfig(
      {
        id: 'project_1',
        slug: 'nexusnote',
        name: 'NexusNote',
        productionBranch: 'main',
        repositoryId: 'repo_1',
        repository: null,
        configJson: {
          services: {
            worker: {
              monorepo: {
                appDir: 'packages/worker',
              },
            },
          },
        },
      } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
      {
        services: [
          {
            id: 'service_worker',
            projectId: 'project_1',
            name: 'worker',
            type: 'worker',
            buildCommand: 'bun run build',
            startCommand: 'bun run worker',
          } as typeof services.$inferSelect,
        ],
        databases: [],
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
            build: 'turbo run build --filter=worker',
          },
        },
      }
    );

    expect(config).toContain('monorepo:');
    expect(config).toContain('appDir: packages/worker');
    expect(config).toContain('# monorepo tells Juanie how to calculate affected services');
    expect(config).toContain(
      '# deliverables are customer-downloadable outputs produced by buildTargets.'
    );
    expect(config).toContain('inputs:');
    expect(config).toContain('      []');
  });

  it('embeds packages monorepo services into CI build metadata', () => {
    const project = {
      id: 'project_1',
      slug: 'nexusnote',
      name: 'NexusNote',
      productionBranch: 'main',
      repositoryId: 'repo_1',
      configJson: {
        monorepo: {
          enabled: true,
          type: 'turborepo',
          packageManager: 'pnpm',
          affected: {
            strategy: 'turbo',
            task: 'build',
            useTaskInputs: true,
            inputs: ['kit/**', 'acs/**'],
          },
        },
        services: {
          worker: {
            monorepo: {
              appDir: 'packages/worker',
              packageName: '@acme/worker',
            },
            runtime: {
              language: 'node',
              framework: 'custom',
              nodeVersion: '22',
            },
            build: {
              strategy: 'dockerfile',
              context: '.',
              dockerfile: 'packages/worker/Dockerfile',
            },
          },
        },
      },
    } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null };
    const serviceList = [
      {
        id: 'service_worker',
        projectId: 'project_1',
        name: 'worker',
        type: 'worker',
        buildCommand: 'bun run build',
        startCommand: 'bun run worker',
      } as typeof services.$inferSelect,
    ];

    const rendered = renderGitHubCIMonorepo(project, serviceList);
    const encoded = rendered.match(/JUANIE_SERVICE_MATRIX_B64: ([A-Za-z0-9+/=]+)/)?.[1];
    const deliverableEncoded = rendered.match(
      /JUANIE_DELIVERABLE_MATRIX_B64: ([A-Za-z0-9+/=]+)/
    )?.[1];
    const affectedEncoded = rendered.match(/JUANIE_AFFECTED_RULES_B64: ([A-Za-z0-9+/=]+)/)?.[1];

    expect(Boolean(encoded)).toBe(true);
    expect(Boolean(deliverableEncoded)).toBe(true);
    expect(Boolean(affectedEncoded)).toBe(true);
    const ciServices = buildMonorepoCiServices(project, serviceList);
    const affectedRules = JSON.parse(
      Buffer.from(encodeMonorepoAffectedRules(project), 'base64').toString('utf8')
    );

    expect(ciServices.length).toBe(1);
    expect(ciServices[0]?.name).toBe('worker');
    expect(ciServices[0]?.appDir).toBe('packages/worker');
    expect(ciServices[0]?.packageName).toBe('@acme/worker');
    expect(ciServices[0]?.type).toBe('worker');
    expect(ciServices[0]?.build.dockerfile).toBe('packages/worker/Dockerfile');
    expect(ciServices[0]?.build.context).toBe('.');
    expect(affectedRules.inputs).toEqual(['kit/**', 'acs/**']);
    expect(affectedRules.task).toBe('build');
    expect(affectedRules.useTaskInputs).toBe(true);
    expect(rendered).toContain('node .juanie/affected-workspace.mjs');
    const affectedScript = readFileSync(
      join(process.cwd(), 'templates', 'ci', 'affected-workspace.mjs'),
      'utf-8'
    );
    expect(affectedScript).toContain('turbo');
    expect(affectedScript).toContain('query');
    expect(affectedScript).toContain('affected');
    expect(affectedScript).toContain('--base');
    expect(affectedScript).toContain('--head');
  });

  it('renders configured deliverables as real manifest entries instead of commented examples', () => {
    const config = renderJuanieConfig(
      {
        id: 'project_1',
        slug: 'dualx',
        name: 'DualX',
        productionBranch: 'main',
        repositoryId: 'repo_1',
        configJson: {
          deliverables: [
            {
              name: 'web-baremetal',
              type: 'baremetal',
              source: { target: 'web-baremetal' },
              variants: [
                {
                  name: 'linux-amd64',
                  platform: 'linux/amd64',
                  extract: { from: '/app/dist', to: '.' },
                  package: {
                    format: 'tar.gz',
                  },
                  checks: [{ command: 'test -d "$JUANIE_ARTIFACT_STAGE"' }],
                },
              ],
            },
          ],
        },
      } as typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
      {
        services: [
          {
            id: 'service_web',
            name: 'web',
            type: 'web',
            buildCommand: 'bun run build',
            startCommand: 'bun run start',
          } as typeof services.$inferSelect,
        ],
        databases: [],
      },
      {
        monorepoType: 'turborepo',
        rootFiles: ['package.json', 'turbo.json'],
        packageManager: 'pnpm',
        bakeDefinition: null,
        bakeTargets: [],
        atlasConfigPath: null,
        atlasConfigContent: null,
        migrationScriptContents: {},
        packageJson: { scripts: {} },
      }
    );

    expect(config).toContain('deliverables:');
    expect(config).toContain('- name: web-baremetal');
    expect(config).toContain('target: web-baremetal');
    expect(config).toContain('from: /app/dist');
    expect(config).not.toContain('# deliverables:');

    const projectWithDeliverableConfig = {
      configJson: {
        buildTargets: [
          {
            name: 'web-baremetal',
            kind: 'bundle',
            monorepo: { appDir: 'packages/exporter', packageName: '@acme/exporter' },
            build: {
              strategy: 'dockerfile',
              dockerfile: '.juanie/build-targets/exporter.Dockerfile',
            },
            output: { path: 'packages/exporter/dist' },
          },
        ],
        deliverables: [
          {
            name: 'web-baremetal',
            type: 'baremetal',
            source: { target: 'web-baremetal' },
            variants: [
              {
                name: 'linux-amd64',
                platform: 'linux/amd64',
                extract: { from: '/app/dist', to: '.' },
                package: { format: 'tar.gz' },
              },
            ],
          },
        ],
      },
    };
    const deliverables = buildMonorepoCiDeliverables(projectWithDeliverableConfig);
    const encodedDeliverables = JSON.parse(
      Buffer.from(encodeMonorepoCiDeliverables(projectWithDeliverableConfig), 'base64').toString(
        'utf8'
      )
    );

    expect(deliverables[0]?.name).toBe('web-baremetal');
    expect(deliverables[0]?.sourceTarget).toBe('web-baremetal');
    expect(deliverables[0]?.variant.extract.from).toBe('/app/dist');
    expect(encodedDeliverables[0]?.variant.package.format).toBe('tar.gz');
  });

  it('keeps build-only target changes out of the runtime service matrix', () => {
    const result = selectMonorepoCiWork({
      shouldBuildAll: false,
      changedFiles: ['packages/exporter/README.md'],
      services: [
        {
          name: 'web',
          type: 'web',
          appDir: 'apps/web',
          packageName: '@acme/web',
          build: {},
        },
      ],
      deliverables: [
        {
          name: 'web-baremetal',
          type: 'baremetal',
          appDir: 'packages/exporter',
          sourceTarget: 'web-baremetal',
          variant: {
            name: 'linux-amd64',
            platform: 'linux/amd64',
            extract: { from: '/app/dist', to: '.' },
            package: { format: 'tar.gz' },
            checks: [],
          },
        },
      ],
    });

    expect(result.deliverables.map((deliverable) => deliverable.name)).toEqual(['web-baremetal']);
    expect(result.services).toEqual([]);
  });

  it('does not rebuild an independent target when only a runtime service changes', () => {
    const result = selectMonorepoCiWork({
      shouldBuildAll: false,
      changedFiles: ['apps/web/src/page.tsx'],
      services: [
        {
          name: 'web',
          type: 'web',
          appDir: 'apps/web',
          packageName: '@acme/web',
          build: {},
        },
      ],
      deliverables: [
        {
          name: 'web-baremetal',
          type: 'baremetal',
          appDir: 'packages/exporter',
          sourceTarget: 'web-baremetal',
          variant: {
            name: 'linux-amd64',
            platform: 'linux/amd64',
            extract: { from: '/app/dist', to: '.' },
            package: { format: 'tar.gz' },
            checks: [],
          },
        },
      ],
    });

    expect(result.services.map((service) => service.name)).toEqual(['web']);
    expect(result.deliverables).toEqual([]);
  });

  it('builds yarn commands without run', () => {
    expect(buildRunScriptCommand('yarn', 'db:migrate')).toBe('yarn db:migrate');
  });

  it('prefers declared package scripts over synthesized package-manager wrappers', () => {
    expect(
      resolvePackageScriptCommand(
        {
          scripts: {
            'db:push': 'node scripts/db-migrate.mjs',
          },
        },
        'bun',
        'db:push'
      )
    ).toBe('node scripts/db-migrate.mjs');
  });
});
