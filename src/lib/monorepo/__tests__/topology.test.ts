import { describe, expect, it } from 'bun:test';
import { inspectRepositoryTopology } from '@/lib/monorepo';

describe('repository topology inspection', () => {
  it('prefers managed juanie config as the canonical service topology', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'juanie.yaml', 'docker-bake.hcl'];
        },
        async getFileContent(_repo, path) {
          if (path === 'juanie.yaml') {
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

  it('keeps managed monorepo affected rules and runtime artifact metadata', async () => {
    const topology = await inspectRepositoryTopology(
      {
        async listRootFiles() {
          return ['turbo.json', 'juanie.yaml'];
        },
        async getFileContent(_repo, path) {
          if (path === 'juanie.yaml') {
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
deliverables:
  - name: dualx-server-baremetal
    type: baremetal
    source:
      service: dualx-server
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
    expect(topology.configDeliverables?.[0]?.source?.service).toBe('dualx-server');
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
});
