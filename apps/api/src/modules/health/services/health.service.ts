import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DrizzleService } from "../../../drizzle/drizzle.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly configService: ConfigService
  ) {}

  async checkDatabaseHealth(): Promise<{
    connected: boolean;
    responseTime: number;
  }> {
    const start = Date.now();
    try {
      // Use Drizzle's db instance to execute a simple query
      await this.drizzleService.db.execute("SELECT 1");
      return {
        connected: true,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - start,
      };
    }
  }

  async getHealthStatus() {
    const dbHealth = await this.checkDatabaseHealth();

    return {
      status: dbHealth.connected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: this.configService.get("APP_VERSION") || "1.0.0",
      environment: this.configService.get("NODE_ENV") || "development",
      services: {
        database: dbHealth.connected ? "healthy" : "unhealthy",
      },
    };
  }

  async checkReadiness() {
    const dbHealth = await this.checkDatabaseHealth();

    if (!dbHealth.connected) {
      throw new Error("Database not ready");
    }

    return {
      status: "ready",
      timestamp: new Date().toISOString(),
    };
  }
}
