import { buildTeamGovernanceSnapshot } from '@/lib/teams/governance-view';

export interface TeamListItemLike {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
}

export interface TeamListCard {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  roleLabel: string;
  initials: string;
}

export function decorateTeamListCards<TTeam extends TeamListItemLike>(
  teams: TTeam[]
): TeamListCard[] {
  return teams.map((item) => {
    const governance = buildTeamGovernanceSnapshot(item.role);
    const initials = item.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      role: item.role,
      roleLabel: governance.roleLabel,
      initials,
    };
  });
}
