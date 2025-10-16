import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
}

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const appVersion = this.configService.get<string>('APP_VERSION', '1.0.0')
    const appEnvironment = this.configService.get<string>('NODE_ENV', 'development')

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: appVersion,
      environment: appEnvironment,
      uptime: process.uptime(),
    }
  }
}
