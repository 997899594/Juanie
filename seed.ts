import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './src/lib/db/index.js';
import {
  integrationGrants,
  integrationIdentities,
  teamMembers,
  teams,
  users,
} from './src/lib/db/schema.js';
import { upsertGrantFromOAuth } from './src/lib/integrations/service/grant-service.js';
import { backfillOwnerBindingForTeam } from './src/lib/integrations/service/team-binding-service.js';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
  console.log('Seeding database...');

  // Create dev user
  let devUser = await db.query.users.findFirst({
    where: eq(users.id, DEV_USER_ID),
  });

  if (!devUser) {
    const [created] = await db
      .insert(users)
      .values({
        id: DEV_USER_ID,
        name: 'Dev User',
        email: 'dev@localhost',
        platformRole: 'operator',
      })
      .returning();
    devUser = created;
    console.log('✅ Created dev user');
  } else {
    if (devUser.platformRole !== 'operator') {
      const [updated] = await db
        .update(users)
        .set({ platformRole: 'operator', updatedAt: new Date() })
        .where(eq(users.id, DEV_USER_ID))
        .returning();
      devUser = updated;
    }
    console.log('✅ Dev user already exists');
  }

  // Create dev team
  let devTeam = await db.query.teams.findFirst({
    where: eq(teams.slug, 'dev-team'),
  });

  if (!devTeam) {
    const [created] = await db
      .insert(teams)
      .values({
        name: 'Dev Team',
        slug: 'dev-team',
      })
      .returning();
    devTeam = created;
    console.log('✅ Created dev team');
  } else {
    console.log('✅ Dev team already exists');
  }

  // Add user to team
  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.teamId, devTeam.id),
  });

  if (!membership) {
    await db.insert(teamMembers).values({
      teamId: devTeam.id,
      userId: devUser.id,
      role: 'owner',
    });
    console.log('✅ Added dev user to dev team');
  } else {
    console.log('✅ Dev user already in team');
  }

  // Create an encrypted development integration grant.
  const existingIdentity = await db.query.integrationIdentities.findFirst({
    where: and(
      eq(integrationIdentities.userId, devUser.id),
      eq(integrationIdentities.provider, 'github')
    ),
  });
  const existingGrant = existingIdentity
    ? await db.query.integrationGrants.findFirst({
        where: and(
          eq(integrationGrants.integrationIdentityId, existingIdentity.id),
          isNull(integrationGrants.revokedAt)
        ),
      })
    : null;

  if (!existingGrant) {
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      throw new Error('ENCRYPTION_MASTER_KEY is required to seed encrypted integration grants');
    }
    await upsertGrantFromOAuth({
      userId: devUser.id,
      provider: 'github',
      accessToken: 'mock-token-for-development',
      scopeRaw: 'repo workflow read:packages',
    });
    console.log('✅ Created encrypted mock integration grant');
  } else {
    console.log('✅ Integration grant already exists');
  }
  await backfillOwnerBindingForTeam(devTeam.id);

  console.log('\n🎉 Seed complete!');
  console.log('You can now log in with "Dev User" credentials');
}

seed().catch(console.error);
