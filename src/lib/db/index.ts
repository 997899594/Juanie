import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getNormalizedDatabaseUrlFromEnv } from './connection-url';
import * as schema from './schema';

function createDb() {
  const connectionString = getNormalizedDatabaseUrlFromEnv();

  const client = postgres(connectionString, {
    max: 10, // 增加连接池大小以支持事务
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

type DatabaseClient = ReturnType<typeof createDb>;

let databaseClient: DatabaseClient | null = null;

export function getDb(): DatabaseClient {
  if (!databaseClient) {
    databaseClient = createDb();
  }

  return databaseClient;
}

export const db: DatabaseClient = new Proxy({} as DatabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
