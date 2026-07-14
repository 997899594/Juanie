type PersistedAuthAccount = {
  access_token?: string | null;
  refresh_token?: string | null;
  id_token?: string | null;
};

export function sanitizePersistedAuthAccount<T extends PersistedAuthAccount>(
  account: T
): T & {
  access_token: null;
  refresh_token: null;
  id_token: null;
} {
  return {
    ...account,
    access_token: null,
    refresh_token: null,
    id_token: null,
  };
}
