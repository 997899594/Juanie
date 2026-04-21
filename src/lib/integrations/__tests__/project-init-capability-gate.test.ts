import { describe, expect, it } from 'bun:test';
import {
  getRequiredCapabilitiesForProjectBootstrap,
  requiredCapabilitiesForStep,
} from '@/lib/queue/project-init-capabilities';

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

  it('requires read_repo and write_workflow for initial build triggers', () => {
    const caps = requiredCapabilitiesForStep('trigger_initial_builds');
    expect(caps).toContain('read_repo');
    expect(caps).toContain('write_workflow');
  });

  it('preflights the full bootstrap capability set before project creation', () => {
    expect(getRequiredCapabilitiesForProjectBootstrap('import')).toEqual([
      'read_repo',
      'write_repo',
      'write_workflow',
    ]);
    expect(getRequiredCapabilitiesForProjectBootstrap('create')).toEqual([
      'write_repo',
      'write_workflow',
      'read_repo',
    ]);
  });
});
