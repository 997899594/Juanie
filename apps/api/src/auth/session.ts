import { getCookie, setCookie } from "h3";
import { randomUUID } from "node:crypto";
import { useStorage } from 'nitropack/runtime';

export async function createSession(event: any, userId: string) {
  const id = randomUUID();
  const storage = useStorage('redis');
  const payload = { userId, createdAt: Date.now() };
  setCookie(event, "session", id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  await storage.setItem(`sess:${id}`, payload, { ttl: 60 * 60 * 24 * 7 });
  return id;
}

export async function getSession(event: any) {
  const id = getCookie(event, "session");
  if (!id) return null;
  const storage = useStorage('redis');
  const payload = await storage.getItem<{ userId: string; createdAt: number }>(`sess:${id}`);
  return payload || null;
}

export async function destroySession(event: any) {
  const id = getCookie(event, "session");
  if (id) {
    const storage = useStorage('redis');
    await storage.removeItem(`sess:${id}`);
  }
  setCookie(event, "session", "", { maxAge: 0, path: "/" });
}
