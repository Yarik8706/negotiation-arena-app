import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** Resolve Neon/Postgres URL without logging it. */
export function getDatabaseUrl(): string | undefined {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim();
  return url || undefined;
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null = null;

/** Neon SQL tagged-template client. Throws if no DATABASE_URL / POSTGRES_URL. */
export function sql(): Sql {
  if (cached) return cached;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
  }
  cached = neon(url);
  return cached;
}
