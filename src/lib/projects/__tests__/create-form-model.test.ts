import { describe, expect, it } from 'bun:test';
import {
  createDatabaseDraft,
  getInitialVariableError,
  isInitialVariableReady,
  normalizeService,
  toServicePayload,
  withServiceIds,
} from '@/lib/projects/create-form-model';

describe('create project form model', () => {
  it('把仓库识别结果规范成可编辑服务草稿', () => {
    const service = normalizeService(
      {
        name: 'web',
        type: 'web',
        startCommand: 'bun start',
        port: 3001,
      },
      'standard'
    );

    expect({
      name: service.name,
      type: service.type,
      appDir: service.appDir,
      build: service.build,
      run: service.run,
      healthcheck: service.healthcheck,
      scaling: service.scaling,
      isPublic: service.isPublic,
    }).toEqual({
      name: 'web',
      type: 'web',
      appDir: '.',
      build: { command: 'npm run build' },
      run: { command: 'bun start', port: 3001 },
      healthcheck: { path: '/api/health', interval: 30 },
      scaling: { min: 1 },
      isPublic: true,
    });
  });

  it('生成数据库草稿时使用平台默认供应方式', () => {
    const database = createDatabaseDraft('postgresql');

    expect({
      name: database.name,
      type: database.type,
      plan: database.plan,
      provisionType: database.provisionType,
      capabilities: database.capabilities,
    }).toEqual({
      name: 'primary',
      type: 'postgresql',
      plan: 'starter',
      provisionType: 'shared',
      capabilities: [],
    });
  });

  it('校验初始变量名和值', () => {
    const variables = [
      { _id: 'one', key: 'DATABASE_URL', value: 'postgres://demo', isSecret: true },
      { _id: 'two', key: ' database_url ', value: 'postgres://demo2', isSecret: true },
      { _id: 'three', key: 'bad-key', value: 'x', isSecret: false },
      { _id: 'four', key: 'EMPTY_VALUE', value: '', isSecret: false },
    ];

    expect(getInitialVariableError(variables[0], variables)).toBe('变量名重复');
    expect(getInitialVariableError(variables[2], variables)).toBe(
      '变量名只能包含字母、数字和下划线'
    );
    expect(getInitialVariableError(variables[3], variables)).toBe('变量值不能为空');
    expect(
      isInitialVariableReady(
        { _id: 'five', key: 'APP_SECRET', value: 'secret', isSecret: true },
        variables
      )
    ).toBe(true);
  });

  it('把表单服务草稿转换成提交载荷', () => {
    const [service] = withServiceIds([
      {
        name: 'worker',
        type: 'cron',
        appDir: 'apps/worker',
        schedule: '*/5 * * * *',
        run: { command: 'bun run worker' },
        isPublic: false,
      },
    ]);

    expect(toServicePayload(service)).toEqual({
      name: 'worker',
      type: 'cron',
      monorepo: { appDir: 'apps/worker' },
      run: { command: 'bun run worker' },
      schedule: '*/5 * * * *',
      isPublic: false,
    });
  });
});
