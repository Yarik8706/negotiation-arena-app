import { profileCredential } from "@/lib/access";
import { isDbConfigured } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getProgress, saveProfile, deleteProfile } from "@/lib/progress/store";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("profileId");
  if (!id) return NextResponse.json({ error: "Нужен profileId" }, { status: 400 });
  if ((isDbConfigured() || process.env.NODE_ENV === "production") && profileCredential(req) !== id) return NextResponse.json({ error: "Нет доступа" }, { status:404 });
  return NextResponse.json(await getProgress(id), { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(req: NextRequest) {
  let body: { profileId?: string; alias?: string; publicRanking?: boolean; calibration?: Record<string, number> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  if (!body.profileId) return NextResponse.json({ error: "Нужен profileId" }, { status: 400 });
  if ((isDbConfigured() || process.env.NODE_ENV === "production") && profileCredential(req) !== body.profileId) return NextResponse.json({ error: "Нет доступа" }, { status:404 });
  if (body.publicRanking !== undefined && typeof body.publicRanking !== "boolean") return NextResponse.json({ error: "publicRanking должен быть boolean" }, { status: 400 });
  if (body.alias !== undefined && typeof body.alias !== "string") return NextResponse.json({error:"Псевдоним должен быть строкой"},{status:400});
  if (body.calibration !== undefined && (!body.calibration || typeof body.calibration !== "object" || Array.isArray(body.calibration))) return NextResponse.json({error:"Некорректная калибровка"},{status:400});
  if (body.calibration && Object.values(body.calibration).some(v => !Number.isInteger(v) || v < 1 || v > 3)) return NextResponse.json({ error: "Оценки калибровки должны быть от 1 до 3" }, { status: 400 });
  const profile = await saveProfile(body.profileId, body); if (!profile) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
  return NextResponse.json(profile);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("profileId");
  if (!id || profileCredential(req) !== id) return NextResponse.json({ error: "Нет доступа" }, { status:404 });
  await deleteProfile(id, req.nextUrl.searchParams.get("scope") === "history");
  return NextResponse.json({ deleted: true });
}
