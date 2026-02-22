import 'dotenv/config';
import { db } from './src/lib/db/index.js';
import { gitProviders, teamMembers, teams, users } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

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
      })
      .returning();
    devUser = created;
    console.log('✅ Created dev user');
  } else {
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

  // Create mock git provider
  const existingProvider = await db.query.gitProviders.findFirst({
    where: eq(gitProviders.userId, devUser.id),
  });

  if (!existingProvider) {
    await db.insert(gitProviders).values({
      userId: devUser.id,
      name: 'GitHub',
      type: 'github',
      accessToken: 'mock-token-for-development',
    });
    console.log('✅ Created mock git provider');
  } else {
    console.log('✅ Git provider already exists');
  }

  console.log('\n🎉 Seed complete!');
  console.log('You can now log in with "Dev User" credentials');
}

seed().catch(console.error);
