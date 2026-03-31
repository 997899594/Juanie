interface TeamApiError {
  error?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await readJson<TeamApiError>(response);
    return data.error ?? '请求失败';
  } catch {
    return '请求失败';
  }
}

export async function fetchTeamMembersSnapshot(teamId: string) {
  const [membersRes, invitationsRes] = await Promise.all([
    fetch(`/api/teams/${teamId}/members`),
    fetch(`/api/teams/${teamId}/invitations`),
  ]);

  if (!membersRes.ok) {
    throw new Error(await readError(membersRes));
  }

  return {
    members: await membersRes.json(),
    invitations: invitationsRes.ok ? await invitationsRes.json() : [],
  };
}

export async function inviteTeamMember(input: { teamId: string; email: string; role: string }) {
  const response = await fetch(`/api/teams/${input.teamId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, role: input.role }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function changeTeamMemberRole(input: {
  teamId: string;
  memberId: string;
  role: string;
}) {
  const response = await fetch(`/api/teams/${input.teamId}/members/${input.memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: input.role }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function removeTeamMember(input: { teamId: string; memberId: string }) {
  const response = await fetch(`/api/teams/${input.teamId}/members/${input.memberId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function createTeamInvitationLink(input: { teamId: string; role: string }) {
  const response = await fetch(`/api/teams/${input.teamId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: input.role }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return readJson<{ inviteUrl: string }>(response);
}

export async function revokeTeamInvitation(input: { teamId: string; invitationId: string }) {
  const response = await fetch(`/api/teams/${input.teamId}/invitations/${input.invitationId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function updateTeamSettings(input: { teamId: string; name: string }) {
  const response = await fetch(`/api/teams/${input.teamId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return readJson<{ id: string; name: string; slug: string }>(response);
}

export async function updateTeamAISettings(input: {
  teamId: string;
  plan: 'free' | 'pro' | 'scale' | 'enterprise';
  plugins: Array<{
    pluginId: string;
    enabled: boolean;
  }>;
}) {
  const response = await fetch(`/api/teams/${input.teamId}/ai`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: input.plan,
      plugins: input.plugins,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return readJson<{
    plan: 'free' | 'pro' | 'scale' | 'enterprise';
    plugins: Array<{
      id: string;
      enabled: boolean;
    }>;
  }>(response);
}

export async function deleteTeam(teamId: string) {
  const response = await fetch(`/api/teams/${teamId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}
