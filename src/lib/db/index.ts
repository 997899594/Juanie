import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getNormalizedDatabaseUrlFromEnv } from './connection-url';
import * as schema from './schema';

const connectionString = getNormalizedDatabaseUrlFromEnv();

const client = postgres(connectionString, {
  max: 10, // 巻加连接池大小以支持事务
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
