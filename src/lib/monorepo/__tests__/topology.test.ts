import { describe, expect, it } from 'bun:test';
import { inspectRepositoryTopology } from '@/lib/monorepo';

describe('repository topology inspection', () => {
  it('prefers managed juanie config as the canonical service topology', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'juanie.yml', 'docker-bake.hcl'];
        },
        async getFileContent(_repo, path) {
          if (path === 'juanie.yml') {
            return `services:\n  - name: worker\n    type: worker\n    monorepo:\n      appDir: packages/worker\n    build:\n      strategy: bake\n      definition: docker-bake.hcl\n      target: worker\n      context: .\n    run:\n      command: bun run worker\n`;
          }

          if (path === 'docker-bake.hcl') {
            return 'target "worker" {}';
          }

          return null;
        },
        async listDirectory() {
          return [];
        },
      },
      'acme/demo',
      'main'
    );

    expect(topology.source).toBe('juanie_config');
    expect(topology.services.length).toBe(1);
    expect(topology.services[0]?.name).toBe('worker');
    expect(topology.services[0]?.type).toBe('worker');
    expect(topology.services[0]?.appDir).toBe('packages/worker');
    expect(topology.services[0]?.build?.strategy).toBe('bake');
    expect(topology.services[0]?.build?.definition).toBe('docker-bake.hcl');
    expect(topology.services[0]?.build?.target).toBe('worker');
  });

  it('probes only the canonical juanie.yml path', async () => {
    const requestedPaths: string[] = [];
    await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['juanie.yml', 'package.json'];
        },
        async getFileContent(_repo, path) {
          requestedPaths.push(path);
          return path === 'package.json' ? '{}' : null;
        },
        async listDirectory() {
          return [];
        },
      },
      'acme/demo',
      'main'
    );

    expect(requestedPaths).toContain('juanie.yml');
    expect(requestedPaths).not.toContain('juanie.yaml');
  });

  it('keeps managed monorepo affected rules and runtime artifact metadata', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'juanie.yml'];
        },
        async getFileContent(_repo, path) {
          if (path === 'juanie.yml') {
            return `
monorepo:
  type: turborepo
  packageManager: pnpm
  affected:
    strategy: turbo
    inputs:
      - kit/**
services:
  - name: dualx-server
    type: web
    runtime:
      language: node
      framework: nest
      nodeVersion: "22"
    monorepo:
      appDir: apps/dualx-server
    build:
      command: pnpm --filter dualx-server build
      package:
        strategy: pnpm-deploy
    run:
      command: ./bin/start
      port: 6014
buildTargets:
  - name: dualx-server
    kind: bundle
    monorepo:
      appDir: apps/dualx-server
      packageName: "@acme/dualx-server"
    build:
      strategy: managed
    output:
      path: apps/dualx-server/dist
deliverables:
  - name: dualx-server-baremetal
    type: baremetal
    source:
      target: dualx-server
    variants:
      - name: linux-amd64
        platform: linux/amd64
        extract:
          from: /app/dist
          to: .
        package:
          format: tar.gz
`;
          }

          return null;
        },
        async listDirectory() {
          return [];
        },
      },
      'acme/dualx',
      'main'
    );

    expect(topology.source).toBe('juanie_config');
    expect(topology.configMonorepo?.affected?.inputs).toEqual(['kit/**']);
    expect(topology.services[0]?.runtime?.framework).toBe('nest');
    expect(topology.services[0]?.build?.package?.strategy).toBe('pnpm-deploy');
    expect(topology.configDeliverables?.[0]?.name).toBe('dualx-server-baremetal');
    expect(topology.configDeliverables?.[0]?.source?.target).toBe('dualx-server');
    expect(topology.managedConfigContent).toContain('deliverables:');
  });

  it('detects apps and packages services and infers worker or cron roles', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'package.json', 'pnpm-lock.yaml'];
        },
        async getFileContent(_repo, path) {
          if (path === 'package.json') {
            return JSON.stringify({ packageManager: 'pnpm@10.0.0' });
          }

          if (path === 'apps/web/package.json') {
            return JSON.stringify({
              name: '@acme/web',
              scripts: {
                start: 'next start -p 3001',
                build: 'next build',
              },
              dependencies: {
                next: '^16.0.0',
              },
            });
          }

          if (path === 'packages/worker/package.json') {
            return JSON.stringify({
              name: '@acme/worker',
              scripts: {
                worker: 'node worker.js',
                build: 'tsup',
              },
            });
          }

          if (path === 'packages/cron/package.json') {
            return JSON.stringify({
              name: '@acme/cron',
              juanie: {
                schedule: '*/5 * * * *',
              },
              scripts: {
                cron: 'node cron.js',
              },
            });
          }

          if (
            path === 'apps/web/Dockerfile' ||
            path === 'packages/worker/Dockerfile' ||
            path === 'packages/cron/Dockerfile'
          ) {
            return 'FROM node:20';
          }

          return null;
        },
        async listDirectory(_repo, path) {
          if (path === 'apps') {
            return [{ name: 'web', path: 'apps/web', type: 'dir' }];
          }

          if (path === 'packages') {
            return [
              { name: 'worker', path: 'packages/worker', type: 'dir' },
              { name: 'cron', path: 'packages/cron', type: 'dir' },
            ];
          }

          return [];
        },
      },
      'acme/demo',
      'main'
    );

    expect(topology.source).toBe('turborepo_scan');
    expect(topology.services.length).toBe(3);
    expect(topology.services[0]?.name).toBe('web');
    expect(topology.services[0]?.type).toBe('web');
    expect(topology.services[0]?.appDir).toBe('apps/web');
    expect(topology.services[0]?.packageName).toBe('@acme/web');
    expect(topology.services[0]?.build?.command).toBe('turbo run build --filter=@acme/web');
    expect(topology.services[0]?.port).toBe(3001);
    expect(topology.services[1]?.name).toBe('worker');
    expect(topology.services[1]?.type).toBe('worker');
    expect(topology.services[1]?.appDir).toBe('packages/worker');
    expect(topology.services[1]?.packageName).toBe('@acme/worker');
    expect(topology.services[1]?.startCommand).toBe('node worker.js');
    expect(topology.services[2]?.name).toBe('cron');
    expect(topology.services[2]?.type).toBe('cron');
    expect(topology.services[2]?.appDir).toBe('packages/cron');
    expect(topology.services[2]?.packageName).toBe('@acme/cron');
    expect(topology.services[2]?.schedule).toBe('*/5 * * * *');
  });

  it('discovers custom and nested pnpm workspaces while honoring exclusions', async () => {
    const requestedDirectories: string[] = [];
    const packageFiles = new Map<string, string>([
      [
        'products/console/package.json',
        JSON.stringify({
          name: '@acme/console',
          scripts: { build: 'vite build', start: 'vite preview --port 4100' },
        }),
      ],
      [
        'platform/services/api/package.json',
        JSON.stringify({
          name: '@acme/api',
          scripts: { build: 'tsc', start: 'node dist/server.js' },
        }),
      ],
      [
        'platform/private/internal/package.json',
        JSON.stringify({
          name: '@acme/internal',
          scripts: { start: 'node index.js' },
        }),
      ],
    ]);
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'];
        },
        async getFileContent(_repo, path) {
          if (path === 'package.json') {
            return JSON.stringify({ packageManager: 'pnpm@11.9.0' });
          }
          if (path === 'pnpm-workspace.yaml') {
            return `packages:\n  - products/*\n  - platform/**\n  - '!platform/private/**'\n`;
          }
          return packageFiles.get(path) ?? null;
        },
        async listDirectory(_repo, path) {
          requestedDirectories.push(path);
          const children: Record<string, string[]> = {
            products: ['console'],
            platform: ['services', 'private'],
            'platform/services': ['api'],
            'platform/private': ['internal'],
          };
          return (children[path] ?? []).map((name) => ({
            name,
            path: `${path}/${name}`,
            type: 'dir' as const,
          }));
        },
      },
      'acme/custom-layout',
      'main'
    );

    expect(topology.services.map((service) => service.packageName)).toEqual([
      '@acme/console',
      '@acme/api',
    ]);
    expect(topology.services.map((service) => service.appDir)).toEqual([
      'products/console',
      'platform/services/api',
    ]);
    expect(topology.services.some((service) => service.packageName === '@acme/internal')).toBe(
      false
    );
    expect(requestedDirectories).toContain('platform/services');
  });

  it('discovers object-form workspace declarations from package.json', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'package.json', 'bun.lock'];
        },
        async getFileContent(_repo, path) {
          if (path === 'package.json') {
            return JSON.stringify({
              packageManager: 'bun@1.3.14',
              workspaces: { packages: ['services/*'] },
            });
          }
          if (path === 'services/gateway/package.json') {
            return JSON.stringify({
              name: '@acme/gateway',
              scripts: { build: 'bun build src/index.ts', start: 'bun dist/index.js' },
            });
          }
          return null;
        },
        async listDirectory(_repo, path) {
          return path === 'services'
            ? [{ name: 'gateway', path: 'services/gateway', type: 'dir' as const }]
            : [];
        },
      },
      'acme/bun-workspaces',
      'main'
    );

    expect(topology.services.map((service) => service.packageName)).toEqual(['@acme/gateway']);
    expect(topology.services[0]?.runtime?.language).toBe('bun');
  });

  it('rejects malformed pnpm workspace declarations instead of returning a partial topology', async () => {
    let error: unknown;
    try {
      await inspectRepositoryTopology(
        {
          async listRootFiles() {
            return ['turbo.json', 'package.json', 'pnpm-workspace.yaml'];
          },
          async getFileContent(_repo, path) {
            if (path === 'package.json') return '{}';
            if (path === 'pnpm-workspace.yaml') return 'packages: [apps/*';
            return null;
          },
          async listDirectory() {
            return [];
          },
        },
        'acme/invalid-workspace',
        'main'
      );
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toContain('Invalid pnpm-workspace.yaml');
  });

  it('projects a Fuser-shaped workspace graph into only real runtime services', async () => {
    const files = new Map<string, string>([
      [
        'package.json',
        JSON.stringify({
          packageManager: 'bun@1.3.11',
          scripts: { postinstall: 'bun scripts/fetch-vision-core.ts' },
        }),
      ],
      [
        '.env.example',
        'OSS_ACCESS_KEY_ID=\nOSS_ACCESS_KEY_SECRET=\nOSS_REGION=oss-cn-beijing\nOSS_BUCKET=product-build\n',
      ],
      [
        'apps/web/package.json',
        JSON.stringify({
          name: '@data-fuser/web',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: { react: '^19.0.0', vite: '^8.0.0' },
        }),
      ],
      [
        'apps/server/package.json',
        JSON.stringify({
          name: '@data-fuser/server',
          scripts: { build: 'nest build', start: 'nest start' },
          dependencies: {
            '@nestjs/core': '^11.0.0',
            '@nestjs/bullmq': '^11.0.0',
            '@nestjs/schedule': '^6.0.0',
            bullmq: '^5.0.0',
            ioredis: '^5.0.0',
            'typeorm-dm': '^1.0.0',
          },
        }),
      ],
      [
        'apps/server/.env.example',
        'DB_HOST=\nDB_PORT=5236\nDB_USER=SYSDBA\nDB_PASSWORD=\nDB_NAME=DAMENG\nREDIS_HOST=\nREDIS_PORT=6379\nAUTH_SERVICE_URL=\n',
      ],
      [
        'apps/docs/package.json',
        JSON.stringify({
          name: '@data-fuser/docs',
          scripts: { build: 'vocs build', 'docs:api': 'typedoc' },
          dependencies: { vocs: '^1.0.0' },
        }),
      ],
      [
        'packages/visionkit/package.json',
        JSON.stringify({
          name: 'visionkit',
          scripts: { build: 'vite build', 'pack-zip': 'bun scripts/pack-zip.ts' },
        }),
      ],
      [
        'packages/ui/package.json',
        JSON.stringify({
          name: '@visionkit/ui',
          scripts: { test: 'vitest run', typecheck: 'tsgo --noEmit' },
          dependencies: { react: '^19.0.0' },
        }),
      ],
    ]);
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'package.json', 'bun.lock', '.env.example'];
        },
        async getFileContent(_repo, path) {
          return files.get(path) ?? null;
        },
        async listDirectory(_repo, path) {
          if (path === 'apps') {
            return ['web', 'server', 'docs'].map((name) => ({
              name,
              path: `apps/${name}`,
              type: 'dir' as const,
            }));
          }
          if (path === 'packages') {
            return ['visionkit', 'ui'].map((name) => ({
              name,
              path: `packages/${name}`,
              type: 'dir' as const,
            }));
          }
          return [];
        },
      },
      'featuremaker/data-fuser',
      'main'
    );

    expect(topology.services.map((service) => service.name)).toEqual(['web', 'server']);
    expect(topology.services[0]?.runtime?.language).toBe('static');
    expect(topology.services[0]?.run).toEqual({
      command: 'nginx -g "daemon off;"',
      port: 8080,
    });
    expect(topology.deliveryGraph.artifacts.map((artifact) => artifact.name)).toEqual([
      'docs',
      'visionkit',
    ]);
    expect(topology.deliveryGraph.libraries.map((library) => library.name)).toEqual(['ui']);
    expect(topology.deliveryGraph.resources.map((resource) => resource.engine)).toEqual([
      'dameng',
      'redis',
      undefined,
      's3-compatible',
    ]);
  });
});
