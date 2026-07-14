import { decrypt, encrypt } from '@/lib/crypto';

interface GrantCredentialRecord {
  id: string;
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  accessTokenAuthTag: string | null;
  refreshTokenEncrypted: string | null;
  refreshTokenIv: string | null;
  refreshTokenAuthTag: string | null;
  encryptionKeyVersion: number | null;
}

function grantAad(grantId: string, kind: 'access' | 'refresh'): string {
  return `integration-grant:${grantId}:${kind}`;
}

export async function encryptGrantCredentials(input: {
  grantId: string;
  accessToken: string;
  refreshToken?: string | null;
}) {
  const accessToken = await encrypt(input.accessToken, {
    aad: grantAad(input.grantId, 'access'),
  });
  const refreshToken = input.refreshToken
    ? await encrypt(input.refreshToken, {
        aad: grantAad(input.grantId, 'refresh'),
        keyVersion: accessToken.keyVersion,
      })
    : null;

  return {
    accessTokenEncrypted: accessToken.encryptedValue,
    accessTokenIv: accessToken.iv,
    accessTokenAuthTag: accessToken.authTag,
    refreshTokenEncrypted: refreshToken?.encryptedValue ?? null,
    refreshTokenIv: refreshToken?.iv ?? null,
    refreshTokenAuthTag: refreshToken?.authTag ?? null,
    encryptionKeyVersion: accessToken.keyVersion,
  };
}

export async function decryptGrantAccessToken(grant: GrantCredentialRecord): Promise<string> {
  if (
    !grant.accessTokenEncrypted ||
    !grant.accessTokenIv ||
    !grant.accessTokenAuthTag ||
    !grant.encryptionKeyVersion
  ) {
    throw new Error(`Integration grant ${grant.id} has not been migrated to encrypted credentials`);
  }

  return decrypt(grant.accessTokenEncrypted, grant.accessTokenIv, grant.accessTokenAuthTag, {
    aad: grantAad(grant.id, 'access'),
    keyVersion: grant.encryptionKeyVersion,
  });
}

export async function decryptGrantRefreshToken(
  grant: GrantCredentialRecord
): Promise<string | null> {
  if (!grant.refreshTokenEncrypted) {
    return null;
  }
  if (!grant.refreshTokenIv || !grant.refreshTokenAuthTag || !grant.encryptionKeyVersion) {
    throw new Error(`Integration grant ${grant.id} has incomplete encrypted refresh credentials`);
  }

  return decrypt(grant.refreshTokenEncrypted, grant.refreshTokenIv, grant.refreshTokenAuthTag, {
    aad: grantAad(grant.id, 'refresh'),
    keyVersion: grant.encryptionKeyVersion,
  });
}
