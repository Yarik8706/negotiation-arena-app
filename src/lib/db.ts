import { neon, Pool, neonConfig, type PoolClient, type NeonQueryFunction } from "@neondatabase/serverless";

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

// Interactive transactions use WebSockets; HTTP remains the fast read path.
let pool: Pool | undefined;
export async function withDbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  neonConfig.webSocketConstructor = WebSocket;
  pool ??= new Pool({ connectionString: getDatabaseUrl(), max: 5, idleTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
