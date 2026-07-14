import { describe, expect, it } from 'bun:test';
import { inferDeliveryGraph } from '@/lib/delivery-graph/inference';
import { summarizeDeliveryGraph } from '@/lib/delivery-graph/model';

describe('delivery graph inference', () => {
  it('把 Fuser 形态仓库分类为运行单元、制品、库和资源', () => {
    const graph = inferDeliveryGraph({
      packageManager: 'bun',
      rootPackageJson: {
        scripts: {
          postinstall: 'bun scripts/fetch-vision-core.ts && bun scripts/fetch-sample-model.ts',
        },
      },
      rootEnvironmentKeys: [
        'OSS_ACCESS_KEY_ID',
        'OSS_ACCESS_KEY_SECRET',
        'OSS_REGION',
        'OSS_BUCKET',
      ],
      workspaces: [
        {
          path: 'apps/web',
          zone: 'app',
          hasDockerfile: false,
          packageJson: {
            name: '@data-fuser/web',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { react: '^19.0.0', vite: '^8.0.0' },
          },
        },
        {
          path: 'apps/server',
          zone: 'app',
          hasDockerfile: false,
          environmentKeys: [
            'DB_HOST',
            'DB_PORT',
            'DB_USER',
            'DB_PASSWORD',
            'DB_NAME',
            'REDIS_HOST',
            'REDIS_PORT',
            'REDIS_PASSWORD',
            'AUTH_SERVICE_URL',
          ],
          packageJson: {
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
          },
        },
        {
          path: 'apps/docs',
          zone: 'app',
          hasDockerfile: false,
          packageJson: {
            name: '@data-fuser/docs',
            scripts: { build: 'vocs build', 'docs:api': 'typedoc' },
            dependencies: { vocs: '^1.0.0' },
          },
        },
        {
          path: 'packages/visionkit',
          zone: 'package',
          hasDockerfile: false,
          packageJson: {
            name: 'visionkit',
            scripts: { build: 'vite build', 'pack-zip': 'bun scripts/pack-zip.ts' },
            dependencies: { react: '^19.0.0' },
          },
        },
        {
          path: 'packages/ui',
          zone: 'package',
          hasDockerfile: false,
          packageJson: {
            name: '@visionkit/ui',
            scripts: { test: 'vitest run', typecheck: 'tsgo --noEmit' },
            dependencies: { react: '^19.0.0' },
          },
        },
      ],
    });

    expect(graph.workloads.map((workload) => workload.name)).toEqual(['web', 'server']);
    expect(graph.workloads[0]?.runtimeKind).toBe('static');
    expect(graph.workloads[0]?.startCommand).toBe('nginx -g "daemon off;"');
    expect(graph.workloads[1]?.runtimeCapabilities).toEqual(['http', 'worker', 'scheduler']);
    expect(graph.artifacts.map((artifact) => artifact.name)).toEqual(['docs', 'visionkit']);
    expect(graph.libraries.map((library) => library.name)).toEqual(['ui']);
    expect(graph.resources.map((resource) => resource.id)).toEqual([
      'resource:database:dameng',
      'resource:queue:redis',
      'resource:service:auth',
      'resource:artifact-source:oss',
    ]);
    expect(graph.resources.find((resource) => resource.engine === 'dameng')?.management).toBe(
      'external'
    );
    expect(graph.resources.find((resource) => resource.engine === 'redis')?.management).toBe(
      'managed'
    );
    expect(graph.warnings.map((warning) => warning.code)).toEqual(['mixed_runtime']);
    expect(summarizeDeliveryGraph(graph)).toEqual({
      workloadCount: 2,
      artifactCount: 2,
      libraryCount: 1,
      managedResourceCount: 1,
      externalResourceCount: 3,
      requiresInput: true,
    });
  });

  it('只有明确运行入口或 Dockerfile 的 packages workspace 才成为 workload', () => {
    const graph = inferDeliveryGraph({
      packageManager: 'pnpm',
      rootPackageJson: null,
      workspaces: [
        {
          path: 'packages/worker',
          zone: 'package',
          hasDockerfile: false,
          packageJson: {
            name: '@acme/worker',
            scripts: { worker: 'node worker.js', build: 'tsup' },
          },
        },
        {
          path: 'packages/sdk',
          zone: 'package',
          hasDockerfile: false,
          packageJson: { name: '@acme/sdk', scripts: { build: 'tsup' } },
        },
      ],
    });

    expect(graph.workloads.map((workload) => workload.name)).toEqual(['worker']);
    expect(graph.workloads[0]?.type).toBe('worker');
    expect(graph.artifacts.map((artifact) => artifact.name)).toEqual(['sdk']);
  });
});
