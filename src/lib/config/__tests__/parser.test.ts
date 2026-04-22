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
});
