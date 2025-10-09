import { getAppContainer } from "../nest";

export async function upsertOAuthAccount(
  provider: "wechat" | "github" | "gitlab",
  providerUserId: string,
  profile: Record<string, unknown>
): Promise<{ userId: string }> {
  const { databaseService } = getAppContainer();
  const user = await databaseService.upsertOAuthAccountAndUser(provider, providerUserId, profile);
  return { userId: user.id };
}

export async function createUserWithEmail(
  email: string,
  passwordHash: string
): Promise<{ userId: string }> {
  const { databaseService } = getAppContainer();
  const exist = await databaseService.getUserByEmail(email);
  if (exist) return { userId: exist.id };
  const name = email.split("@")[0] || "User";
  const user = await databaseService.createUser({ email, password: passwordHash, name });
  return { userId: user.id };
}

export async function findUserByEmail(
  email: string
): Promise<{ userId: string; passwordHash: string } | null> {
  const { databaseService } = getAppContainer();
  const user = await databaseService.getUserByEmail(email);
  if (!user) return null;
  return { userId: user.id, passwordHash: user.passwordHash };
}
