import { describe, expect, it } from 'bun:test';
import { createBuildPlan, getBuildPlanReleaseServices } from '@/lib/builds/plan';
import type { JuanieConfig } from '@/lib/config/parser';

describe('build plan', () => {
  it('groups services that share a docker bake definition without splitting the release', () => {
    const config = {
      services: [
        {
          name: 'web',
          type: 'web',
          build: {
            strategy: 'bake',
            definition: 'docker-bake.hcl',
            context: '.',
            target: 'web',
          },
          run: {
            command: 'npm start',
            port: 3000,
          },
        },
        {
          name: 'worker',
          type: 'worker',
          build: {
            strategy: 'bake',
            definition: 'docker-bake.hcl',
            context: '.',
            target: 'worker',
          },
          run: {
            command: 'bun run worker:all',
          },
        },
      ],
    } satisfies Pick<JuanieConfig, 'services'>;

    const plan = createBuildPlan({
      config,
      repository: '997899594/nexusnote',
      ref: 'refs/heads/main',
      sha: 'abc123',
    });

    expect(plan.release).toEqual({
      mode: 'aggregate',
      requiredUnits: ['web', 'worker'],
    });
    expect(plan.groups).toEqual([
      {
        id: 'bake-docker-bake.hcl',
        mode: 'bake_group',
        units: ['web', 'worker'],
        sharedCacheKey: 'bake:.:docker-bake.hcl',
        buildDefinition: 'docker-bake.hcl',
      },
    ]);
    expect(getBuildPlanReleaseServices(plan)).toEqual([
      {
        name: 'web',
        image: 'ghcr.io/997899594/nexusnote:sha-abc123-web',
      },
      {
        name: 'worker',
        image: 'ghcr.io/997899594/nexusnote:sha-abc123-worker',
      },
    ]);
  });

  it('uses a service matrix when independent services do not share a bake group', () => {
    const config = {
      monorepo: {
        type: 'turborepo',
      },
      services: [
        {
          name: 'admin',
          type: 'web',
          monorepo: {
            appDir: 'apps/admin',
          },
          build: {
            strategy: 'dockerfile',
            dockerfile: 'apps/admin/Dockerfile',
            context: '.',
          },
          run: {
            command: 'node server.js',
            port: 3000,
          },
        },
        {
          name: 'api',
          type: 'web',
          monorepo: {
            appDir: 'apps/api',
          },
          build: {
            strategy: 'dockerfile',
            dockerfile: 'apps/api/Dockerfile',
            context: '.',
          },
          run: {
            command: 'node server.js',
            port: 3000,
          },
        },
      ],
    } satisfies Pick<JuanieConfig, 'services' | 'monorepo'>;

    const plan = createBuildPlan({
      config,
      repository: 'acme/platform',
      ref: 'refs/heads/main',
      sha: 'def456',
    });

    expect(plan.groups).toEqual([
      {
        id: 'affected-admin',
        mode: 'affected_matrix',
        units: ['admin'],
        sharedCacheKey: null,
        buildDefinition: null,
      },
      {
        id: 'affected-api',
        mode: 'affected_matrix',
        units: ['api'],
        sharedCacheKey: null,
        buildDefinition: null,
      },
    ]);
    expect(getBuildPlanReleaseServices(plan).map((service) => service.image)).toEqual([
      'ghcr.io/acme/platform:sha-def456-admin',
      'ghcr.io/acme/platform:sha-def456-api',
    ]);
  });

  it('rejects selected services that are not part of the project topology', () => {
    const config = {
      services: [
        {
          name: 'web',
          type: 'web',
          run: {
            command: 'npm start',
          },
        },
      ],
    } satisfies Pick<JuanieConfig, 'services'>;

    expect(() =>
      createBuildPlan({
        config,
        repository: 'acme/app',
        ref: 'refs/heads/main',
        sha: 'abc123',
        selectedServices: ['worker'],
      })
    ).toThrow('Build plan references unknown services: worker');
  });
});
