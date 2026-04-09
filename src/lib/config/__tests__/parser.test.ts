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
});
