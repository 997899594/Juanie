import { db } from '../src/lib/db';
import { gitProviders } from '../src/lib/db/schema';

async function main() {
  const providers = await db.select().from(gitProviders);
  console.log(JSON.stringify(providers, null, 2));
}

main();
