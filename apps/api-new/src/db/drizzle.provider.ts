import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const PG_CONNECTION = 'PG_CONNECTION';

export const drizzleProvider = {
  provide: PG_CONNECTION,
  useFactory: () => {
    const connectionString = process.env.DATABASE_URL!;
    const client = postgres(connectionString);
    return drizzle(client, { schema });
  },
  inject: [],
};