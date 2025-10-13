import { Injectable } from '@nestjs/common'
import type { AuthService } from '../modules/auth/services/auth.service'
import type { DatabaseService } from '../modules/database/services/database.service'

@Injectable()
export class TrpcService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  async validateRequest(authHeader?: string) {
    return await this.authService.validateRequest(authHeader)
  }

  async getCurrentUser(token?: string) {
    return await this.authService.getCurrentUser(token)
  }

  async getDatabase() {
    return this.databaseService.getDb()
  }

  async checkDatabaseHealth() {
    return await this.databaseService.checkHealth()
  }
}
