import { describe, expect, it } from 'bun:test';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';

describe('juanie tool runtime', () => {
  it('rejects unknown tools', async () => {
    try {
      await executeJuanieTool({
        toolId: 'unknown-tool',
        context: {
          teamId: 'team-id',
        },
      });
      throw new Error('expected tool execution to fail');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toBe('Unknown Juanie tool: unknown-tool');
    }
  });

  it('rejects read environment tool calls without required scope ids', async () => {
    try {
      await executeJuanieTool({
        toolId: 'read-environment-context',
        context: {
          teamId: 'team-id',
        },
      });
      throw new Error('expected tool execution to fail');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toBe(
        'read-environment-context requires projectId and environmentId'
      );
    }
  });

  it('rejects write tool calls without reason and approval token', async () => {
    try {
      await executeJuanieTool({
        toolId: 'approve-migration-run',
        context: {
          teamId: 'team-id',
          actorUserId: 'user-id',
          projectId: 'project-id',
          migrationRunId: 'run-id',
        },
      });
      throw new Error('expected tool execution to fail');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toBe(
        'approve-migration-run requires an explicit execution reason'
      );
    }
  });
});
