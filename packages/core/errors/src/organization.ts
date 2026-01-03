import { AppError } from './base'

export class OrganizationNotFoundError extends AppError {
  constructor(organizationId: string) {
    super('Organization not found', 'ORGANIZATION_NOT_FOUND', 404, false, { organizationId })
  }

  getUserMessage(): string {
    return '组织不存在'
  }
}

export class OrganizationMemberAlreadyExistsError extends AppError {
  constructor(organizationId: string, userId: string) {
    super(
      'User is already a member of this organization',
      'ORGANIZATION_MEMBER_ALREADY_EXISTS',
      409,
      false,
      { organizationId, userId },
    )
  }

  getUserMessage(): string {
    return '该用户已经是组织成员'
  }
}

export class NotOrganizationMemberError extends AppError {
  constructor(organizationId: string, userId?: string) {
    super(
      'User is not a member of this organization',
      'NOT_ORGANIZATION_MEMBER',
      403,
      false,
      { organizationId, userId },
    )
  }

  getUserMessage(): string {
    return '您不是该组织的成员'
  }
}

export class CannotRemoveOwnerError extends AppError {
  constructor(organizationId: string) {
    super(
      'Cannot remove organization owner',
      'CANNOT_REMOVE_OWNER',
      403,
      false,
      { organizationId },
    )
  }

  getUserMessage(): string {
    return '无法移除组织所有者'
  }
}
