import { describe, expect, it } from 'bun:test';
import {
  getRequiredCapabilitiesForProjectBootstrap,
  requiredCapabilitiesForStep,
} from '@/lib/queue/project-init-capabilities';

describe('project init capability gates', () => {
  it('requires repository access but not workflow mutation for push_cicd_config', () => {
    expect(requiredCapabilitiesForStep('push_cicd_config')).toEqual(['read_repo', 'write_repo']);
  });

  it('requires read_repo for validate_repository', () => {
    expect(requiredCapabilitiesForStep('validate_repository')).toContain('read_repo');
  });

  it('requires only write_repo for push_template', () => {
    const caps = requiredCapabilitiesForStep('push_template');
    expect(caps).toContain('write_repo');
    expect(caps).not.toContain('write_workflow');
  });

  it('uses platform dispatch for initial build triggers', () => {
    const caps = requiredCapabilitiesForStep('trigger_initial_builds');
    expect(caps).toContain('read_repo');
    expect(caps).not.toContain('write_workflow');
  });

  it('requires webhook management for source event registration', () => {
    expect(requiredCapabilitiesForStep('configure_release_trigger')).toEqual(['manage_webhook']);
  });

  it('preflights the full bootstrap capability set before project creation', () => {
    expect(getRequiredCapabilitiesForProjectBootstrap('import')).toEqual([
      'read_repo',
      'write_repo',
      'manage_webhook',
    ]);
    expect(getRequiredCapabilitiesForProjectBootstrap('create')).toEqual([
      'write_repo',
      'read_repo',
      'manage_webhook',
    ]);
  });
});
