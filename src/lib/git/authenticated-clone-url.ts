import { normalizeGitLabServerUrl } from '@/lib/git/gitlab-server';

export function buildAuthenticatedCloneUrl(input: {
  cloneUrl: string | null;
  fullName: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  accessToken: string;
  serverUrl: string | null;
}): string {
  const fallbackUrl =
    input.cloneUrl ??
    (input.provider === 'github'
      ? `https://github.com/${input.fullName}.git`
      : `${normalizeGitLabServerUrl(input.serverUrl)}/${input.fullName}.git`);
  const url = new URL(fallbackUrl);

  if (input.provider === 'github') {
    url.username = 'x-access-token';
    url.password = input.accessToken;
  } else {
    url.username = 'oauth2';
    url.password = input.accessToken;
  }

  return url.toString();
}
