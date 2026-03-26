import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, environments, projects, teamMembers } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { buildDeploymentRolloutPlan, finalizeDeploymentRollout } from '@/lib/releases/rollout';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  const { id, depId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限访问项目' }, { status: 403 });
  }

  const targetDeployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, depId),
  });

  if (!targetDeployment || targetDeployment.projectId !== id) {
    return NextResponse.json({ error: '部署不存在' }, { status: 404 });
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, targetDeployment.environmentId),
  });

  if (!environment || environment.projectId !== id) {
    return NextResponse.json({ error: '环境不存在' }, { status: 404 });
  }

  if (!canManageEnvironment(member.role, environment)) {
    return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
  }

  return NextResponse.json(
    await buildDeploymentRolloutPlan({ projectId: id, deploymentId: depId })
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  const { id, depId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限访问项目' }, { status: 403 });
  }

  const targetDeployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, depId),
  });

  if (!targetDeployment || targetDeployment.projectId !== id) {
    return NextResponse.json({ error: '部署不存在' }, { status: 404 });
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, targetDeployment.environmentId),
  });

  if (!environment || environment.projectId !== id) {
    return NextResponse.json({ error: '环境不存在' }, { status: 404 });
  }

  if (!canManageEnvironment(member.role, environment)) {
    return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
  }

  try {
    return NextResponse.json(
      await finalizeDeploymentRollout({ projectId: id, deploymentId: depId })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推进放量失败' },
      { status: 400 }
    );
  }
}
