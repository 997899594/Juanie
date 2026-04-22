import { describe, expect, it } from 'bun:test';
import { getCommandBarConfig, resolveCommandBarScope } from '@/lib/ai/command-bar';

describe('ai command bar', () => {
  it('resolves environment scope from environment routes', () => {
    expect(resolveCommandBarScope('/projects/p1/environments/e1')).toEqual({
      kind: 'environment',
      projectId: 'p1',
      environmentId: 'e1',
    });
  });

  it('resolves release scope from release routes', () => {
    expect(resolveCommandBarScope('/projects/p1/environments/e1/delivery/r1')).toEqual({
      kind: 'release',
      projectId: 'p1',
      environmentId: 'e1',
      releaseId: 'r1',
    });
  });

  it('marks unsupported routes clearly', () => {
    expect(resolveCommandBarScope('/projects')).toEqual({
      kind: 'unsupported',
    });
  });

  it('builds environment command config', () => {
    const config = getCommandBarConfig('/projects/p1/environments/e1');

    expect(config.endpoint).toBe('/api/projects/p1/environments/e1/copilot');
    expect(config.taskEndpoint).toBe('/api/projects/p1/environments/e1/tasks');
    expect(config.suggestions).toContain('当前环境最该先看什么？');
  });

  it('builds release command config', () => {
    const config = getCommandBarConfig('/projects/p1/environments/e1/delivery/r1');

    expect(config.endpoint).toBe('/api/projects/p1/releases/r1/copilot');
    expect(config.taskEndpoint).toBe('/api/projects/p1/releases/r1/tasks');
    expect(config.suggestions).toContain('这次发布现在安全吗？');
  });
});
