import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Config } from "../../../config/configuration";
import { DrizzleService } from "../../../drizzle/drizzle.service";
import type { HealthStatus } from "../../../lib/types/index";

@Injectable()
export class HealthService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly configService: ConfigService<Config>
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

  async getHealthStatus(): Promise<HealthStatus> {
    const appConfig = this.configService.get("app");
    const version = appConfig?.version || "unknown";
    const environment = appConfig?.environment || "unknown";

    const dbHealth = await this.checkDatabaseHealth();

    return {
      status: dbHealth.connected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version,
      environment,
      services: {
        database: dbHealth.connected ? "healthy" : "unhealthy",
      },
      details: {
        database: dbHealth,
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
