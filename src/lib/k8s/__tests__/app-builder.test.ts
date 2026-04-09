import { describe, expect, it } from 'bun:test';
import { AppBuilder } from '../app-builder';
import type { AppSpec } from '../types';

describe('AppBuilder', () => {
  const baseSpec: AppSpec = {
    projectId: 'test-project-id',
    name: 'my-app',
    namespace: 'juanie-my-app',
    image: {
      repository: 'ghcr.io/test/app',
      tag: 'v1.0.0',
      pullPolicy: 'Always',
    },
    replicas: 2,
    port: 3000,
  };

  it('should build deployment with correct name', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.deployment.metadata.name).toBe('my-app');
  });

  it('should build deployment with correct replicas', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.deployment.spec.replicas).toBe(2);
  });

  it('should build deployment with correct image', () => {
    const resources = AppBuilder.build(baseSpec);
    const image = resources.deployment.spec.template.spec.containers[0].image;
    expect(image).toBe('ghcr.io/test/app:v1.0.0');
  });

  it('should build service with correct name', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.service.metadata.name).toBe('my-app');
  });

  it('should not build configMap when no env', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.configMap).toBeUndefined();
  });

  it('should build configMap when env provided', () => {
    const spec: AppSpec = {
      ...baseSpec,
      env: { NODE_ENV: 'production', API_URL: 'https://api.example.com' },
    };
    const resources = AppBuilder.build(spec);
    expect(resources.configMap).toBeDefined();
    expect(resources.configMap.data.NODE_ENV).toBe('production');
  });

  it('should not build httpRoute when no hostname', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.httpRoute).toBeUndefined();
  });

  it('should build httpRoute when hostname provided', () => {
    const spec: AppSpec = {
      ...baseSpec,
      hostname: 'my-app.juanie.art',
    };
    const resources = AppBuilder.build(spec);
    expect(resources.httpRoute).toBeDefined();
    expect(resources.httpRoute.spec.hostnames).toContain('my-app.juanie.art');
  });

  it('should add juanie labels to all resources', () => {
    const resources = AppBuilder.build(baseSpec);

    expect(resources.deployment.metadata.labels['juanie.dev/managed-by']).toBe('resource-manager');
    expect(resources.deployment.metadata.labels['juanie.dev/project-id']).toBe('test-project-id');
    expect(resources.deployment.metadata.labels['juanie.dev/app-name']).toBe('my-app');

    expect(resources.service.metadata.labels['juanie.dev/managed-by']).toBe('resource-manager');
  });

  it('should add healthcheck probes when configured', () => {
    const spec: AppSpec = {
      ...baseSpec,
      healthcheck: {
        path: '/health',
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
    };
    const resources = AppBuilder.build(spec);

    expect(resources.deployment.spec.template.spec.containers[0].livenessProbe).toBeDefined();
    expect(resources.deployment.spec.template.spec.containers[0].readinessProbe).toBeDefined();
    expect(resources.deployment.spec.template.spec.containers[0].livenessProbe.httpGet.path).toBe(
      '/health'
    );
  });

  it('should generate consistent hash for same spec', () => {
    const resources1 = AppBuilder.build(baseSpec);
    const resources2 = AppBuilder.build(baseSpec);

    const hash1 = AppBuilder.hashResources(resources1);
    const hash2 = AppBuilder.hashResources(resources2);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different spec', () => {
    const resources1 = AppBuilder.build(baseSpec);
    const resources2 = AppBuilder.build({ ...baseSpec, replicas: 3 });

    const hash1 = AppBuilder.hashResources(resources1);
    const hash2 = AppBuilder.hashResources(resources2);

    expect(hash1).not.toBe(hash2);
  });
});
