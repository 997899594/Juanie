import { AppError } from './base'

export class TeamNotFoundError extends AppError {
  constructor(teamId: string) {
    super('Team not found', 'TEAM_NOT_FOUND', 404, false, { teamId })
  }

  getUserMessage(): string {
    return '团队不存在'
  }
}

export class TeamMemberAlreadyExistsError extends AppError {
  constructor(teamId: string, userId: string) {
    super(
      'User is already a member of this team',
      'TEAM_MEMBER_ALREADY_EXISTS',
      409,
      false,
      { teamId, userId },
    )
  }

  getUserMessage(): string {
    return '该用户已经是团队成员'
  }
}

export class TeamMemberNotFoundError extends AppError {
  constructor(teamId: string, userId: string) {
    super(
      `User ${userId} is not a member of team ${teamId}`,
      'TEAM_MEMBER_NOT_FOUND',
      404,
      false,
      { teamId, userId },
    )
  }

  getUserMessage(): string {
    return '该用户不是团队成员'
  }
}

export class NotTeamMemberError extends AppError {
  constructor(teamId: string, userId?: string) {
    super(`User is not a member of team ${teamId}`, 'NOT_TEAM_MEMBER', 403, false, {
      teamId,
      userId,
    })
  }

  getUserMessage(): string {
    return '您不是该团队的成员'
  }
}
