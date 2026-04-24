import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projects, teamMembers, teams } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import {
  type CreateProjectInput,
  createProjectWithBootstrap,
  isCreateProjectError,
} from '@/lib/projects/create-project-service';

const routeLogger = logger.child({ route: 'api/projects' });

export async function GET() {
  try {
    const session = await requireSession();
    const userProjects = await db
      .select({
        project: projects,
        teamName: teams.name,
      })
      .from(projects)
      .innerJoin(teams, eq(teams.id, projects.teamId))
      .innerJoin(
        teamMembers,
        and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, session.user.id))
      );

    return NextResponse.json(userProjects);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    routeLogger.error('Failed to list projects', error);
    return NextResponse.json(
      {
        error: '加载项目列表失败',
        code: 'project_list_failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Omit<CreateProjectInput, 'userId'>;
    const result = await createProjectWithBootstrap({
      ...body,
      userId: session.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    if (isCreateProjectError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details ?? undefined,
        },
        { status: error.status }
      );
    }

    routeLogger.error('Failed to create project', error);
    return NextResponse.json(
      {
        error: '创建项目失败',
        code: 'project_create_failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
