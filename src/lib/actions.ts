'use server';

import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, teamMembers, teams } from '@/lib/db/schema';

export async function createTeam(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const slug = formData.get('slug') as string;

  if (!name || !slug) {
    return { error: 'Name and slug are required' };
  }

  const existingTeam = await db.query.teams.findFirst({
    where: eq(teams.slug, slug),
  });

  if (existingTeam) {
    return { error: 'Slug already exists' };
  }

  const [team] = await db.insert(teams).values({ name, slug }).returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: session.user.id,
    role: 'owner',
  });

  revalidatePath('/teams');
  return { success: true, team };
}

export async function createProject(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const teamId = formData.get('teamId') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;

  if (!teamId || !name) {
    return { error: 'Team ID and name are required' };
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember || !['owner', 'admin', 'member'].includes(teamMember.role)) {
    return { error: 'Forbidden' };
  }

  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;

  const [project] = await db
    .insert(projects)
    .values({
      teamId,
      name,
      slug,
      description,
      status: 'initializing',
    })
    .returning();

  revalidatePath('/projects');
  return { success: true, project };
}

export async function deleteProject(projectId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return { error: 'Project not found' };
  }

  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!teamMember || teamMember.role !== 'owner') {
    return { error: 'Only owner can delete project' };
  }

  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath('/projects');
  return { success: true };
}
