import { AppError } from './base'

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super('User not found', 'USER_NOT_FOUND', 404, false, { userId })
  }

  getUserMessage(): string {
    return '用户不存在'
  }
}

export class UserEmailExistsError extends AppError {
  constructor(email: string) {
    super('User email already exists', 'USER_EMAIL_EXISTS', 409, false, { email })
  }

  getUserMessage(): string {
    return '该邮箱已被注册'
  }
}

export class UserInvalidEmailError extends AppError {
  constructor(email: string) {
    super('Invalid email format', 'USER_INVALID_EMAIL', 400, false, { email })
  }

  getUserMessage(): string {
    return '邮箱格式不正确'
  }
}
