import { promises as fs } from "fs";
import path from "path";
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
    opponent: { ...seed.opponent, ...scenario.opponent, hiddenInterests: scenario.opponent.hiddenInterests ?? seed.opponent.hiddenInterests, constraints: scenario.opponent.constraints ?? seed.opponent.constraints },
  };
}

async function readAll(): Promise<Scenario[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const rawParsed = JSON.parse(raw) as Scenario[];
    if (!Array.isArray(rawParsed) || rawParsed.length === 0) {
      return [SEED_SCENARIO, ...ALL_SCENARIOS];
    }
    const parsed = rawParsed.map((scenario) => preserveSeedCapabilities({ ...scenario, version: scenario.version ?? 1 }));
    if (!parsed.some((s) => s.id === SEED_SCENARIO.id)) {
      return [SEED_SCENARIO, ...ALL_SCENARIOS.filter((item) => !parsed.some((s) => s.id === item.id)), ...parsed];
    }
    return [...ALL_SCENARIOS.filter((item) => !parsed.some((s) => s.id === item.id)), ...parsed];
  } catch {
    return [SEED_SCENARIO, ...ALL_SCENARIOS];
  }
}

async function writeAll(scenarios: Scenario[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const builtIns = [SEED_SCENARIO, ...ALL_SCENARIOS];
  const stable = (value: unknown): string => Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`
      : JSON.stringify(value);
  const persisted = scenarios.filter((scenario) => {
    const builtIn = builtIns.find((item) => item.id === scenario.id);
    if (!builtIn) return true;
    const withoutDates = (item: Scenario) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "createdAt" && key !== "updatedAt"));
    return stable(withoutDates(scenario)) !== stable(withoutDates(builtIn));
  });
  await fs.writeFile(DATA_FILE, JSON.stringify(persisted, null, 2), "utf8");
}

export async function listScenarios(includeDrafts = false): Promise<Scenario[]> {
  const all = await readAll();
  return includeDrafts ? all : all.filter((s) => s.status !== "draft");
}

export async function getScenario(id: string, includeDraft = false): Promise<Scenario | null> {
  const all = await readAll();
  const scenario = all.find((s) => s.id === id) ?? null;
  return scenario && (includeDraft || scenario.status !== "draft") ? scenario : null;
}

export async function saveScenario(scenario: Scenario): Promise<Scenario> {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === scenario.id);
  const next = { ...scenario, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await writeAll(all);
  return next;
}

export async function deleteScenario(id: string): Promise<boolean> {
  if (id === SEED_SCENARIO.id) return false;
  const all = await readAll();
  const filtered = all.filter((s) => s.id !== id);
  if (filtered.length === all.length) return false;
  await writeAll(filtered);
  return true;
}

export async function replaceAll(scenarios: Scenario[]): Promise<Scenario[]> {
  const hasSeed = scenarios.some((s) => s.id === SEED_SCENARIO.id);
  const next = hasSeed ? scenarios : [SEED_SCENARIO, ...scenarios];
  await writeAll(next);
  return next;
}

export function toPublicScenario(s: Scenario): PublicScenario {
  const opponent = { name: s.opponent.name, role: s.opponent.role, sphere: s.opponent.sphere, tone: s.opponent.tone, personality: s.opponent.personality, style: s.opponent.style };
  const publicFields = { ...s };
  delete publicFields.outcomeRules;
  delete publicFields.signals;
  return { ...publicFields, opponent };
}

export function validateScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Scenario>;
  return typeof s.id === "string" && !!s.id.trim() && typeof s.title === "string" && !!s.title.trim()
    && typeof s.playerBrief === "string" && !!s.playerBrief.trim()
    && !!s.opponent && typeof s.opponent.name === "string" && typeof s.opponent.role === "string"
    && typeof s.opponent.systemPrompt === "string" && Array.isArray(s.opponent.goals)
    && Array.isArray(s.opponent.redLines)
    && (!s.variationOptions || s.variationOptions.every((v) => typeof v.id === "string" && typeof v.parameter === "string" && Array.isArray(v.values) && v.values.length >= 2));
}
