import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pipelineRuns, pipelines, projects } from '@/lib/db/schema';

interface GitHubWorkflowRun {
  action: string;
  workflow_run: {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    repository: {
      full_name: string;
    };
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  const event = request.headers.get('x-github-event');
  if (event !== 'workflow_run') {
    return NextResponse.json({ message: 'Ignored event' });
  }

  try {
    const data = JSON.parse(body) as GitHubWorkflowRun;
    const { action, workflow_run } = data;

    if (action !== 'completed' && action !== 'in_progress') {
      return NextResponse.json({ message: 'Ignored action' });
    }

    const repoFullName = workflow_run.repository.full_name;

    const project = await db.query.projects.findFirst({
      where: eq(projects.gitRepository, `https://github.com/${repoFullName}`),
    });

    if (!project) {
      return NextResponse.json({ message: 'Project not found' });
    }

    const pipeline = await db.query.pipelines.findFirst({
      where: eq(pipelines.projectId, project.id),
    });

    if (!pipeline) {
      return NextResponse.json({ message: 'Pipeline not found' });
    }

    let status: 'pending' | 'deploying' | 'deployed' | 'failed' = 'pending';
    if (action === 'in_progress') {
      status = 'deploying';
    } else if (workflow_run.conclusion === 'success') {
      status = 'deployed';
    } else if (workflow_run.conclusion === 'failure') {
      status = 'failed';
    }

    await db.insert(pipelineRuns).values({
      pipelineId: pipeline.id,
      status,
      startedAt: new Date(workflow_run.created_at),
      finishedAt: action === 'completed' ? new Date(workflow_run.updated_at) : null,
      commitSha: workflow_run.head_sha,
    });

    return NextResponse.json({ message: 'Processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
