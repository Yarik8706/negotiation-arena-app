import { createHash, timingSafeEqual } from "node:crypto";
import { isDbConfigured } from "./db";
import { getAttempt } from "./attempts/store";

export function isAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_API_TOKEN;
  if (!secret) return !isDbConfigured() && process.env.NODE_ENV !== "production";
  const cookie = req.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith("arena-admin="))?.slice("arena-admin=".length);
  if (cookie && cookie === createHash("sha256").update(secret).digest("hex")) return true;
  const auth = req.headers.get("authorization") ?? "";
  let supplied = auth.replace(/^Bearer\s+/i, "");
  if (auth.startsWith("Basic ")) {
    supplied = Buffer.from(auth.slice(6), "base64").toString("utf8").replace(/^[^:]*:/, "");
  }
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function profileCredential(req: Request): string | null {
  const value = req.headers.get("x-profile-id");
  return value && /^[a-zA-Z0-9_-]{12,80}$/.test(value) ? value : null;
}
export async function accessibleAttempt(req: Request, id: string) {
  const attempt = await getAttempt(id);
  if (!attempt) return null;
  if (!isDbConfigured() && process.env.NODE_ENV !== "production") return attempt;
  return attempt.profileId && attempt.profileId === profileCredential(req) ? attempt : null;
}
