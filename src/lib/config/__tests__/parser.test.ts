import { describe, expect, it } from 'bun:test';
import { parseJuanieConfig } from '@/lib/config/parser';

describe('juanie config parser', () => {
  it('requires explicit migration executionMode', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    migrate:
      tool: drizzle
      workingDirectory: .
      command: npm run db:push
      phase: preDeploy
      approvalPolicy: manual_in_production
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'services.0.migrate.executionMode: Invalid option: expected one of "automatic"|"manual_platform"|"external"'
    );
  });

  it('rejects legacy autoRun migration config', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    migrate:
      tool: drizzle
      workingDirectory: .
      command: npm run db:push
      phase: preDeploy
      executionMode: manual_platform
      autoRun: false
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain('services.0.migrate: Unrecognized key: "autoRun"');
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

  it('rejects automatic migrations bound to non-postgresql databases', () => {
    const parsed = parseJuanieConfig(`
services:
  - name: web
    type: web
    run:
      command: npm start
      port: 3000
    databases:
      - binding: mysql
        migrate:
          tool: drizzle
          workingDirectory: .
          command: npm run db:migrate
          executionMode: automatic
databases:
  - name: mysql
    type: mysql
    provisionType: standalone
`);

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain(
      'Service "web" 绑定的数据库 "mysql" (mysql) 暂不支持 automatic 自动迁移'
    );
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
