import { NextResponse } from 'next/server';
import { buildRunRequestBaseSchema } from '@/lib/builds/api-schema';
import { BuildRunError, prepareBuildAnalysis } from '@/lib/builds/service';
import { isCiAccessError } from '@/lib/releases/api-access';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = buildRunRequestBaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid build analysis request',
          details: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        { status: 400 }
      );
    }

    const result = await prepareBuildAnalysis({
      ...parsed.data,
      authHeader: request.headers.get('authorization'),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status =
      error instanceof BuildRunError ? error.statusCode : isCiAccessError(error) ? 401 : 400;
    return NextResponse.json(
      {
        error: 'Failed to prepare build analysis',
        details: error instanceof Error ? error.message : String(error),
      },
      { status }
    );
  }
}
