import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Config } from "../config/configuration";
import * as schema from "./schemas";

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  public readonly db: PostgresJsDatabase<typeof schema>;
  private readonly client: postgres.Sql;

  constructor(private configService: ConfigService<Config>) {
    const connectionString = this.configService.get("database.url", { infer: true });

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
