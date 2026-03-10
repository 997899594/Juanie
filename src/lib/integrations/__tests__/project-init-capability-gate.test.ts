import { describe, expect, it } from 'bun:test';
import { requiredCapabilitiesForStep } from '@/lib/queue/project-init';

describe('project init capability gates', () => {
  it('requires write_workflow for push_cicd_config', () => {
    expect(requiredCapabilitiesForStep('push_cicd_config')).toContain('write_workflow');
  });

  it('requires read_repo for validate_repository', () => {
    expect(requiredCapabilitiesForStep('validate_repository')).toContain('read_repo');
  });

  it('requires write_repo and write_workflow for push_template', () => {
    const caps = requiredCapabilitiesForStep('push_template');
    expect(caps).toContain('write_repo');
    expect(caps).toContain('write_workflow');
  });
});
