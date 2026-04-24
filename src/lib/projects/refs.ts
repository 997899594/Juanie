export function getRepositoryDefaultBranch(
  input:
    | {
        defaultBranch?: string | null;
      }
    | null
    | undefined
): string {
  const branch = input?.defaultBranch?.trim();
  return branch && branch.length > 0 ? branch : 'main';
}

export function getProjectProductionBranch(
  input:
    | {
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  const branch = input?.productionBranch?.trim();
  return branch && branch.length > 0 ? branch : getRepositoryDefaultBranch(input?.repository);
}

export function buildBranchHeadRef(branch: string): string {
  const normalized = branch.trim();
  return normalized.startsWith('refs/heads/') ? normalized : `refs/heads/${normalized}`;
}

export function getProjectProductionRef(
  input:
    | {
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  return buildBranchHeadRef(getProjectProductionBranch(input));
}

export function getProjectSourceRef(
  input:
    | {
        branch?: string | null;
        productionBranch?: string | null;
        repository?: {
          defaultBranch?: string | null;
        } | null;
      }
    | null
    | undefined
): string {
  const branch = input?.branch?.trim();
  return branch ? buildBranchHeadRef(branch) : getProjectProductionRef(input);
}
