import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schemas";

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  public readonly db: ReturnType<typeof drizzle>;
  private readonly client: postgres.Sql;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>("DATABASE_URL");

    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.client = postgres(connectionString);
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
    }
  }
}
