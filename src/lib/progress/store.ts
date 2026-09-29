import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isDbConfigured, sql } from "@/lib/db";
import { listAttempts, listRankingAttempts } from "@/lib/attempts/store";
import type { Attempt } from "@/lib/scenarios/types";

const FILE = path.join(process.env.ARENA_DATA_DIR ?? path.join(process.cwd(), "data"), "profiles.json");

export type Profile = {
  id: string;
  alias: string;
  publicRanking: boolean;
  calibration: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

function parsePayload(payload: unknown): Profile {
  return (typeof payload === "string" ? JSON.parse(payload) : payload) as Profile;
}

async function readProfilesJson(): Promise<Profile[]> {
  try {
    const value = JSON.parse(await fs.readFile(FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function writeProfilesJson(items: Profile[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

async function readProfilesDb(): Promise<Profile[]> {
  const db = sql();
  const rows = await db`SELECT payload FROM profiles ORDER BY updated_at ASC`;
  return rows.map((row) => parsePayload(row.payload));
}

async function getProfileDb(id: string): Promise<Profile | null> {
  const db = sql();
  const rows = await db`SELECT payload FROM profiles WHERE id = ${id} LIMIT 1`;
  return rows[0] ? parsePayload(rows[0].payload) : null;
}

async function upsertProfileDb(profile: Profile, patch: Partial<Pick<Profile,"alias"|"publicRanking"|"calibration">>): Promise<Profile> {
  const changes = { updatedAt:profile.updatedAt, ...Object.fromEntries(Object.keys(patch).filter((k)=>["alias","publicRanking","calibration"].includes(k)).map((k)=>[k, profile[k as keyof Profile]])) };
  const db = sql();
  const rows = await db`
    INSERT INTO profiles (id, payload, updated_at)
    VALUES (${profile.id}, ${JSON.stringify(profile)}::jsonb, ${profile.updatedAt}::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      payload = profiles.payload || ${JSON.stringify(changes)}::jsonb,
      updated_at = EXCLUDED.updated_at
    RETURNING payload
  `;
  return parsePayload(rows[0].payload);
}

async function readProfiles(): Promise<Profile[]> {
  return isDbConfigured() ? readProfilesDb() : readProfilesJson();
}

export async function getProfile(id: string) {
  if (isDbConfigured()) return getProfileDb(id);
  return (await readProfilesJson()).find((item) => item.id === id) ?? null;
}

export async function saveProfile(id: string, patch: Partial<Pick<Profile, "alias" | "publicRanking" | "calibration">>) {
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(id)) return null;
  const current = await getProfile(id);
  const now = new Date().toISOString();
  const alias =
    typeof patch.alias === "string"
      ? patch.alias.trim().replace(/[<>\n\r]/g, "").slice(0, 24)
      : (current?.alias ?? "Переговорщик");
  const profile: Profile = {
    id,
    alias: alias || "Переговорщик",
    publicRanking: patch.publicRanking === true || (patch.publicRanking === undefined && current?.publicRanking === true),
    calibration: patch.calibration ?? current?.calibration ?? {},
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  if (isDbConfigured()) {
    return upsertProfileDb(profile, patch);
  }
  const profiles = await readProfilesJson();
  const index = profiles.findIndex((p) => p.id === id);
  if (index < 0) profiles.push(profile);
  else profiles[index] = profile;
  await writeProfilesJson(profiles);
  return profile;
}

export async function getProgress(id: string) {
  const [profile, all] = await Promise.all([getProfile(id), listAttempts(id)]);
  const attempts = all.filter((a) => a.profileId === id && a.status === "completed" && a.report);
  const skills = new Map<string, { name: string; mode: string; scenarioId: string; scenarioTitle: string; version: number; scores: number[]; evidence: number }>();
  for (const attempt of attempts) {
    if ((attempt.practiceMode ?? "independent") === "diagnostic") continue;
    for (const [name, score] of Object.entries(attempt.report?.skillScores ?? {})) {
      const mode = attempt.practiceMode ?? "independent";
      const key = `${attempt.scenarioId}:${attempt.scenarioVersion}:${mode}:${name}`;
      const entry = skills.get(key) ?? { name, mode, scenarioId:attempt.scenarioId, scenarioTitle:attempt.scenario.title, version:attempt.scenarioVersion, scores: [], evidence: 0 };
      entry.scores.push(score);
      entry.evidence += 1;
      skills.set(key, entry);
    }
  }
  const skillRows = [...skills.values()]
    .map((item) => ({
      name: item.name,
      mode: item.mode,
      scenarioId: item.scenarioId,
      scenarioTitle: item.scenarioTitle,
      version: item.version,
      score: Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length),
      attempts: item.evidence,
      trend: item.scores.length > 1 ? item.scores.at(-1)! - item.scores[0] : 0,
    }))
    .sort((a, b) => a.mode.localeCompare(b.mode) || b.score - a.score);
  const achievements = [
    {
      id: "first",
      title: "Первый раунд",
      description: "Завершите первую самостоятельную попытку",
      earned: attempts.some((a) => (a.practiceMode ?? "independent") === "independent"),
    },
    {
      id: "listener",
      title: "Сначала понять",
      description: "Выявите интересы в трёх раундах",
      earned: attempts.filter((a) => a.signals.includes("asks-needs")).length >= 3,
    },
    {
      id: "next-step",
      title: "Есть следующий шаг",
      description: "Зафиксируйте следующий шаг в трёх раундах",
      earned: attempts.filter((a) => a.signals.includes("sets-next-step")).length >= 3,
    },
    {
      id: "responsible",
      title: "Границы соблюдены",
      description: "Откажитесь от невыполнимого обещания",
      earned: attempts.some((a) => a.signals.includes("declines-unrealistic")),
    },
    {
      id: "reflect",
      title: "Практика с выводом",
      description: "Повторите сценарий и сравните попытки",
      earned: attempts.some((a) => Boolean(a.report?.comparison)),
    },
  ];
  const calibrationCount = Object.keys(profile?.calibration ?? {}).length;
  const independentSkills = skillRows.filter((s) => s.mode === "independent");
  const weakest = independentSkills.slice().sort((a, b) => a.score - b.score)[0];
  const recommendation = weakest
    ? {
        skill: weakest.name,
        explanation: `Попробуйте отработать «${weakest.name}» в самостоятельной попытке.`,
        scenarioId:
          attempts.find(
            (a) =>
              (a.practiceMode ?? "independent") === "independent" && a.report?.skillScores?.[weakest.name] !== undefined
          )?.scenarioId ?? "pilot-prospect",
      }
    : {
        skill: "Самостоятельный раунд",
        explanation: "Пройдите первый самостоятельный сценарий, чтобы получить наблюдаемую стартовую точку.",
        scenarioId: "pilot-prospect",
      };
  return {
    profile,
    attempts: attempts.map((a) => ({
      id: a.id,
      scenarioId: a.scenarioId,
      scenarioTitle: a.scenario.title,
      scenarioVersion: a.scenarioVersion,
      difficulty: a.scenario.difficulty ?? "Средняя",
      mode: a.practiceMode ?? "independent",
      outcome: a.report?.outcome,
      skillScores: a.report?.skillScores,
      comparison: a.report?.comparison,
      createdAt: a.createdAt,
      signals: a.signals,
    })),
    skills: skillRows,
    recommendation,
    achievements,
    calibrationCount,
    calibrationReady: calibrationCount >= 3,
    totalAttempts: attempts.length,
    totalPoints: attempts.reduce((sum, a) => sum + (a.report?.outcome?.score ?? 0), 0),
  };
}

export async function leaderboard(scenarioId: string, scenarioVersion: number, difficulty: string, mode: string, period = "all", viewerId?: string) {
  const [profiles, attempts] = await Promise.all([readProfiles(), listRankingAttempts(scenarioId,period)]);
  const inPeriod = (a: Attempt) => period === "all" || a.createdAt.startsWith(period);
  const byProfile = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (
      a.profileId && inPeriod(a) &&
      a.status === "completed" &&
      a.report?.outcome &&
      a.scenarioId === scenarioId &&
      a.scenarioVersion === scenarioVersion &&
      (a.scenario.difficulty ?? "Средняя") === difficulty &&
      (a.practiceMode ?? "independent") === mode
    ) {
      byProfile.set(a.profileId, [...(byProfile.get(a.profileId) ?? []), a]);
    }
  }
  const ranked = [...byProfile]
    .flatMap(([id, rows]) => {
      const p = profiles.find((x) => x.id === id);
      if (!p?.publicRanking || !rows.length) return [];
      const best = Math.max(...rows.map((a) => a.report?.outcome?.score ?? 0));
      return [
        {
          profileId: id,
          alias: p.alias,
          score: best,
          attempts: rows.length,
          outcome: rows.find((a) => a.report?.outcome?.score === best)?.report?.outcome?.label ?? "",
          scenarioId,
          difficulty,
          mode,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.alias.localeCompare(b.alias, "ru"));
  const withRank = ranked.map((row, i) => ({ ...row, rank: ranked.findIndex((r) => r.score === row.score) + 1, order:i+1 }));
  const own = viewerId ? withRank.find((r) => r.profileId === viewerId) : undefined;
  return { rows: withRank.slice(0,50).map(({ profileId: _id, order: _order, ...row }) => { void _id; void _order; return row; }), ownPosition: own ? { rank:own.rank,score:own.score } : null };

}

export async function deleteProfile(id: string, historyOnly = false) {
  if (isDbConfigured()) {
    const db = sql();
    await db.transaction([
      db`DELETE FROM attempts WHERE payload->>'profileId' = ${id}`,
      ...(historyOnly ? [] : [db`DELETE FROM profiles WHERE id = ${id}`]),
    ]);
  } else {
    const { deleteAttempt } = await import("@/lib/attempts/store");
    for (const attempt of await listAttempts()) if (attempt.profileId === id) await deleteAttempt(attempt.id);
    if (!historyOnly) await writeProfilesJson((await readProfilesJson()).filter((p) => p.id !== id));
  }
}
