import { describe, expect, it } from 'bun:test';
import { parseJuanieConfig } from '@/lib/config/parser';

describe('juanie config parser', () => {
  it('defaults schema executionMode to automatic when omitted', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    schema:
      source: drizzle
      phase: preDeploy
      approvalPolicy: manual_in_production
`);

    expect(parsed.isValid).toBe(true);
    expect(parsed.services[0]?.schema?.executionMode).toBe('automatic');
  });

  it('rejects legacy migrate config blocks', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    migrate:
      tool: drizzle
      command: npm run db:push
`);

    expect(parsed.isValid).toBe(false);
    expect(
      parsed.errors.some((error) => error.includes('services.0') && error.includes('migrate'))
    ).toBe(true);
  });

  it('rejects unsupported database provision combinations', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
databases:
  - name: mysql
    type: mysql
    provisionType: shared
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'databases.0.provisionType: MySQL 目前只支持 独立资源、外部实例，不支持 共享资源'
    );
  });

  it('accepts automatic migrations bound to mysql databases', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    databases:
      - binding: mysql
        schema:
          source: drizzle
          executionMode: automatic
databases:
  - name: mysql
    type: mysql
    provisionType: standalone
`);

    expect(parsed.isValid).toBe(true);
  });

  it('rejects automatic migrations bound to mongodb databases', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    databases:
      - binding: analytics
        schema:
          source: typeorm
          executionMode: automatic
databases:
  - name: analytics
    type: mongodb
    provisionType: external
    externalUrl: mongodb://127.0.0.1:27017/app
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'Service "web" 绑定的数据库 "analytics" (mongodb) 暂不支持 automatic 自动迁移'
    );
  });

  it('rejects schema bindings on redis runtime resources', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: worker
    type: worker
    run:
      command: npm start
    databases:
      - binding: redis
        schema:
          source: atlas
          executionMode: external
databases:
  - name: redis
    type: redis
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'Service "worker" 绑定的数据库 "redis" (redis) 是运行时资源，不参与 Juanie schema 管理'
    );
  });

  it('rejects manual platform-managed sql migrations on mongodb databases', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: worker
    type: worker
    run:
      command: npm start
    databases:
      - binding: analytics
        schema:
          source: sql
          executionMode: manual_platform
databases:
  - name: analytics
    type: mongodb
    provisionType: external
    externalUrl: mongodb://127.0.0.1:27017/app
`);

    expect(parsed.isValid).toBe(false);
    expect(
      parsed.errors.some(
        (error) =>
          error.includes('schema.source=sql') &&
          error.includes('mongodb') &&
          error.includes('请改为 external')
      )
    ).toBe(true);
  });

  it('explains unsupported managed sources without implying Atlas must become app release truth', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    databases:
      - binding: primary
        schema:
          source: prisma
          executionMode: automatic
databases:
  - name: primary
    type: postgresql
    provisionType: standalone
`);

    expect(parsed.isValid).toBe(false);
    expect(
      parsed.errors.some(
        (error) =>
          error.includes('schema.source=drizzle / atlas / sql') &&
          error.includes('Atlas 做 diff / repair / adopt 治理') &&
          error.includes('不是要求子应用把发布主链统一改成 Atlas')
      )
    ).toBe(true);
  });

  it('rejects external urls whose protocol does not match the database type', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
databases:
  - name: redis
    type: redis
    provisionType: external
    externalUrl: postgresql://user:pass@host:5432/db
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'databases.0.externalUrl: Redis 外部连接串必须使用 redis: / rediss: 协议'
    );
  });

  it('accepts monorepo affected rules, service runtime metadata, and deliverable variants', () => {
    const parsed = parseJuanieConfig(`
monorepo:
  type: turborepo
  packageManager: pnpm
  affected:
    strategy: turbo
    global:
      - package.json
      - pnpm-lock.yaml
    inputs:
      - kit/**
      - acs/**
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
        checks:
          - command: test -n "$(find "$JUANIE_ARTIFACT_STAGE" -mindepth 1 -print -quit)"
`);

    expect(parsed.isValid).toBe(true);
    expect(parsed.monorepo?.affected?.inputs).toEqual(['kit/**', 'acs/**']);
    expect(parsed.services[0]?.runtime?.framework).toBe('nest');
    expect(parsed.services[0]?.build?.package?.strategy).toBe('pnpm-deploy');
    expect(parsed.deliverables?.[0]?.variants[0]?.extract.from).toBe('/app/dist');
  });

  it('requires delivery artifacts to declare the source image service', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
deliverables:
  - name: kit
    type: package
    variants:
      - name: sdk
        extract:
          from: /app/dist
        package:
          format: tgz
          platform: any
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'deliverables.0.source.service: deliverables must declare source.service for image-derived extraction'
    );
  });
});
