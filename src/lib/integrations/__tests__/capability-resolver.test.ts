import { describe, expect, it } from 'bun:test';
import { resolveGitHubCapabilities } from '@/lib/integrations/domain/capability';

describe('resolveGitHubCapabilities', () => {
  it('maps repo without workflow correctly', () => {
    const caps = resolveGitHubCapabilities(['repo', 'user:email']);
    expect(caps).toContain('write_repo');
    expect(caps).not.toContain('write_workflow');
  });
});
