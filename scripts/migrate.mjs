#!/usr/bin/env node
/**
 * Apply SQL files in db/migrations/ in lexical order using Neon serverless.
 * Requires DATABASE_URL (or POSTGRES_URL / DATABASE_URL_UNPOOLED).
 * Usage: npm run db:migrate
 * Never prints connection string values.
 */
import { readdir, readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);

function loadEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!url) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.local (e.g. via `vercel env pull`) then re-run: npm run db:migrate"
  );
  process.exit(1);
}

const sql = neon(url);

function splitStatements(sqlText) {
  const statements = [];
  let current = "";
  for (const line of sqlText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;
    current += (current ? "\n" : "") + line;
    if (trimmed.endsWith(";")) {
      const stmt = current.trim().replace(/;$/, "").trim();
      if (stmt) statements.push(stmt);
      current = "";
    }
  }
  const leftover = current.trim();
  if (leftover) statements.push(leftover);
  return statements;
}

async function ensureMigrationsTable() {
  await sql.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`
  );
}

async function appliedIds() {
  const rows = await sql`SELECT id FROM _migrations`;
  return new Set(rows.map((r) => r.id));
}

async function applyFile(name, fullPath) {
  const text = await readFileAsync(fullPath, "utf8");
  const statements = splitStatements(text);
  await sql.transaction([
    ...statements.filter((statement) => !/CREATE TABLE IF NOT EXISTS _migrations/i.test(statement)).map((statement) => sql.query(statement)),
    sql`INSERT INTO _migrations (id) VALUES (${name})`,
  ]);
}

const migrationsDir = path.join(root, "db", "migrations");
const files = (await readdirAsync(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

await ensureMigrationsTable();
const done = await appliedIds();

let applied = 0;
for (const file of files) {
  if (done.has(file)) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  console.log(`apply ${file}`);
  await applyFile(file, path.join(migrationsDir, file));
  applied += 1;
}

console.log(applied === 0 ? "No new migrations." : `Applied ${applied} migration(s).`);
