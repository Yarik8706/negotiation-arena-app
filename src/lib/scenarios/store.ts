import { promises as fs } from "fs";
import path from "path";
import { isDbConfigured, sql } from "@/lib/db";
import { ALL_SCENARIOS, SEED_SCENARIO } from "./seed";
import type { PublicScenario, Scenario } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "scenarios.json");

function preserveSeedCapabilities(scenario: Scenario): Scenario {
  const seed = ALL_SCENARIOS.find((item) => item.id === scenario.id);
  if (!seed) return scenario;
  return {
    ...seed,
    ...scenario,
    category: scenario.category ?? seed.category,
    mainSkill: scenario.mainSkill ?? seed.mainSkill,
    estimatedDuration: scenario.estimatedDuration ?? seed.estimatedDuration,
    variationOptions: scenario.variationOptions ?? seed.variationOptions,
    signals: scenario.signals ?? seed.signals,
    outcomeRules: scenario.outcomeRules ?? seed.outcomeRules,
    theory: scenario.theory ?? seed.theory,
    opponent: {
      ...seed.opponent,
      ...scenario.opponent,
      hiddenInterests: scenario.opponent.hiddenInterests ?? seed.opponent.hiddenInterests,
      constraints: scenario.opponent.constraints ?? seed.opponent.constraints,
    },
  };
}

function builtInScenarios(): Scenario[] {
  const byId = new Map<string, Scenario>();
  for (const item of [SEED_SCENARIO, ...ALL_SCENARIOS]) byId.set(item.id, item);
  return [...byId.values()];
}

function mergeWithBuiltIns(parsed: Scenario[]): Scenario[] {
  const mapped = parsed.map((scenario) =>
    preserveSeedCapabilities({ ...scenario, version: scenario.version ?? 1 })
  );
  const missing = builtInScenarios().filter((item) => !mapped.some((s) => s.id === item.id));
  return [...missing, ...mapped];
}

/* ---------- JSON file backend ---------- */

async function readAllJson(): Promise<Scenario[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const rawParsed = JSON.parse(raw) as Scenario[];
    if (!Array.isArray(rawParsed) || rawParsed.length === 0) return builtInScenarios();
    return mergeWithBuiltIns(rawParsed);
  } catch {
    return builtInScenarios();
  }
}

async function writeAllJson(scenarios: Scenario[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const builtIns = builtInScenarios();
  const stable = (value: unknown): string =>
    Array.isArray(value)
      ? `[${value.map(stable).join(",")}]`
      : value && typeof value === "object"
        ? `{${Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
            .join(",")}}`
        : JSON.stringify(value);
  const persisted = scenarios.filter((scenario) => {
    const builtIn = builtIns.find((item) => item.id === scenario.id);
    if (!builtIn) return true;
    const withoutDates = (item: Scenario) =>
      Object.fromEntries(Object.entries(item).filter(([key]) => key !== "createdAt" && key !== "updatedAt"));
    return stable(withoutDates(scenario)) !== stable(withoutDates(builtIn));
  });
  await fs.writeFile(DATA_FILE, JSON.stringify(persisted, null, 2), "utf8");
}

/* ---------- Neon backend ---------- */

function rowToScenario(row: Record<string, unknown>): Scenario {
  const payload = (typeof row.payload === "string" ? JSON.parse(row.payload as string) : row.payload) as Scenario;
  const version = typeof row.version === "number" ? row.version : (payload.version ?? 1);
  return preserveSeedCapabilities({ ...payload, version });
}

async function seedNeonIfEmpty(): Promise<Scenario[]> {
  const db = sql();
  const countRows = await db`SELECT COUNT(*)::int AS count FROM scenarios`;
  const count = Number(countRows[0]?.count ?? 0);
  if (count > 0) {
    const rows = await db`SELECT id, payload, version, updated_at FROM scenarios ORDER BY id ASC`;
    return mergeWithBuiltIns(rows.map(rowToScenario));
  }

  // Prefer existing local JSON once, else in-code defaults.
  let seeds = builtInScenarios();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Scenario[];
    if (Array.isArray(parsed) && parsed.length > 0) seeds = mergeWithBuiltIns(parsed);
  } catch {
    /* use built-ins */
  }

  for (const scenario of seeds) {
    const version = scenario.version ?? 1;
    const updatedAt = scenario.updatedAt ?? new Date().toISOString();
    await db`
      INSERT INTO scenarios (id, payload, version, updated_at)
      VALUES (${scenario.id}, ${JSON.stringify(scenario)}::jsonb, ${version}, ${updatedAt}::timestamptz)
      ON CONFLICT (id) DO NOTHING
    `;
  }
  return seeds;
}

async function readAllDb(): Promise<Scenario[]> {
  return seedNeonIfEmpty();
}

async function writeAllDb(scenarios: Scenario[]): Promise<void> {
  const db = sql();
  const ids = scenarios.map((s) => s.id);
  if (ids.length === 0) {
    await db`DELETE FROM scenarios`;
    return;
  }
  await db`DELETE FROM scenarios WHERE id <> ALL(${ids})`;
  for (const scenario of scenarios) {
    const version = scenario.version ?? 1;
    const updatedAt = scenario.updatedAt ?? new Date().toISOString();
    await db`
      INSERT INTO scenarios (id, payload, version, updated_at)
      VALUES (${scenario.id}, ${JSON.stringify(scenario)}::jsonb, ${version}, ${updatedAt}::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        version = EXCLUDED.version,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

async function upsertScenarioDb(scenario: Scenario): Promise<void> {
  const db = sql();
  const version = scenario.version ?? 1;
  const updatedAt = scenario.updatedAt ?? new Date().toISOString();
  await db`
    INSERT INTO scenarios (id, payload, version, updated_at)
    VALUES (${scenario.id}, ${JSON.stringify(scenario)}::jsonb, ${version}, ${updatedAt}::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      payload = EXCLUDED.payload,
      version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at
  `;
}

async function deleteScenarioDb(id: string): Promise<boolean> {
  const db = sql();
  const rows = await db`DELETE FROM scenarios WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

/* ---------- Public API ---------- */

async function readAll(): Promise<Scenario[]> {
  return isDbConfigured() ? readAllDb() : readAllJson();
}

async function writeAll(scenarios: Scenario[]): Promise<void> {
  if (isDbConfigured()) await writeAllDb(scenarios);
  else await writeAllJson(scenarios);
}

export async function listScenarios(includeDrafts = false): Promise<Scenario[]> {
  const all = await readAll();
  return includeDrafts ? all : all.filter((s) => s.status !== "draft");
}

export async function getScenario(id: string, includeDraft = false): Promise<Scenario | null> {
  if (isDbConfigured()) {
    const db = sql();
    const rows = await db`SELECT id, payload, version FROM scenarios WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) {
      // May need first-time seed
      const all = await readAllDb();
      const scenario = all.find((s) => s.id === id) ?? null;
      return scenario && (includeDraft || scenario.status !== "draft") ? scenario : null;
    }
    const scenario = rowToScenario(rows[0]);
    return includeDraft || scenario.status !== "draft" ? scenario : null;
  }
  const all = await readAllJson();
  const scenario = all.find((s) => s.id === id) ?? null;
  return scenario && (includeDraft || scenario.status !== "draft") ? scenario : null;
}

export async function saveScenario(scenario: Scenario): Promise<Scenario> {
  const next = { ...scenario, updatedAt: new Date().toISOString() };
  if (isDbConfigured()) {
    await upsertScenarioDb(next);
    return next;
  }
  const all = await readAllJson();
  const idx = all.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await writeAllJson(all);
  return next;
}

export async function deleteScenario(id: string): Promise<boolean> {
  if (id === SEED_SCENARIO.id) return false;
  if (isDbConfigured()) return deleteScenarioDb(id);
  const all = await readAllJson();
  const filtered = all.filter((s) => s.id !== id);
  if (filtered.length === all.length) return false;
  await writeAllJson(filtered);
  return true;
}

export async function replaceAll(scenarios: Scenario[]): Promise<Scenario[]> {
  const hasSeed = scenarios.some((s) => s.id === SEED_SCENARIO.id);
  const next = hasSeed ? scenarios : [SEED_SCENARIO, ...scenarios];
  await writeAll(next);
  return next;
}

export function toPublicScenario(s: Scenario): PublicScenario {
  const opponent = {
    name: s.opponent.name,
    role: s.opponent.role,
    sphere: s.opponent.sphere,
    tone: s.opponent.tone,
    personality: s.opponent.personality,
    style: s.opponent.style,
  };
  const publicFields = { ...s };
  delete publicFields.outcomeRules;
  delete publicFields.signals;
  return { ...publicFields, opponent };
}

export function validateScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Scenario>;
  return (
    typeof s.id === "string" &&
    !!s.id.trim() &&
    typeof s.title === "string" &&
    !!s.title.trim() &&
    typeof s.playerBrief === "string" &&
    !!s.playerBrief.trim() &&
    !!s.opponent &&
    typeof s.opponent.name === "string" &&
    typeof s.opponent.role === "string" &&
    typeof s.opponent.systemPrompt === "string" &&
    Array.isArray(s.opponent.goals) &&
    Array.isArray(s.opponent.redLines) &&
    (!s.variationOptions ||
      s.variationOptions.every(
        (v) =>
          typeof v.id === "string" &&
          typeof v.parameter === "string" &&
          Array.isArray(v.values) &&
          v.values.length >= 2
      ))
  );
}
