import { describe, expect, it } from 'bun:test';
import { buildTeamIntegrationsView } from '@/lib/teams/view';

describe('team integrations view', () => {
  it('flags degraded personal bindings', () => {
    const view = buildTeamIntegrationsView({
      role: 'owner',
      bindings: [
        {
          id: 'binding-1',
          label: 'owner-personal',
          provider: 'github',
          authMode: 'personal',
          isDefault: true,
          revokedAt: null,
          grantRevokedAt: null,
          grantExpiresAt: null,
          identityOwner: 'former-owner@example.com',
          ownerStillMember: false,
        },
      ],
    });

    expect(view.bindings[0]?.statusTone).toBe('danger');
  });

  it('marks service binding as healthy when grant is active', () => {
    const view = buildTeamIntegrationsView({
      role: 'admin',
      bindings: [
        {
          id: 'binding-2',
          label: 'service-bot',
          provider: 'github',
          authMode: 'service',
          isDefault: true,
          revokedAt: null,
          grantRevokedAt: null,
          grantExpiresAt: null,
          identityOwner: 'bot@company.local',
          ownerStillMember: true,
        },
      ],
    });

    expect(view.bindings[0]?.statusTone).toBe('success');
  });
});
