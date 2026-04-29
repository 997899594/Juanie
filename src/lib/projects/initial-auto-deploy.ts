interface InitialAutoDeployEnvironment {
  branch?: string | null;
  autoDeploy?: boolean | null;
  isPreview?: boolean | null;
}

export function resolveInitialAutoDeployRefs(
  environmentList: InitialAutoDeployEnvironment[]
): string[] {
  return Array.from(
    new Set(
      environmentList
        .filter((environment) => environment.autoDeploy && !environment.isPreview)
        .map((environment) => environment.branch?.trim())
        .filter((branch): branch is string => Boolean(branch))
        .map((branch) => (branch.startsWith('refs/heads/') ? branch : `refs/heads/${branch}`))
    )
  );
}

function formatInitialAutoDeployRefs(refs: string[]): string {
  return refs.map((ref) => ref.replace(/^refs\/heads\//, '')).join('、');
}

export function buildInitialAutoDeploySummary(input: {
  refs: string[];
  triggeredRefs: string[];
  missingRefs: string[];
}): string {
  if (input.refs.length === 0) {
    return '没有需要触发的首发构建';
  }

  const segments: string[] = [];

  if (input.triggeredRefs.length > 0) {
    segments.push(`已触发 ${input.triggeredRefs.length} 个首发构建`);
  }

  if (input.missingRefs.length > 0) {
    segments.push(`跳过不存在的分支：${formatInitialAutoDeployRefs(input.missingRefs)}`);
  }

  return segments.join('，') || '没有可触发的首发构建';
}

function normalizeInitialAutoDeployRef(branch: string | null | undefined): string | null {
  const normalized = branch?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.startsWith('refs/heads/') ? normalized : `refs/heads/${normalized}`;
}

export function resolveInitialAutoDeployEnvironmentsForRef<T extends InitialAutoDeployEnvironment>(
  environmentsForProject: T[],
  ref: string
): T[] {
  return environmentsForProject.filter(
    (environment) =>
      environment.autoDeploy &&
      !environment.isPreview &&
      normalizeInitialAutoDeployRef(environment.branch) === ref
  );
}
