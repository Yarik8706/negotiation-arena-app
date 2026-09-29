import { NextRequest, NextResponse } from "next/server";
import { getProgress, saveProfile } from "@/lib/progress/store";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("profileId");
  if (!id) return NextResponse.json({ error: "Нужен profileId" }, { status: 400 });
  return NextResponse.json(await getProgress(id));
}
export async function PUT(req: NextRequest) {
  let body: { profileId?: string; alias?: string; publicRanking?: boolean; calibration?: Record<string, number> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  if (!body.profileId) return NextResponse.json({ error: "Нужен profileId" }, { status: 400 });
  if (body.publicRanking !== undefined && typeof body.publicRanking !== "boolean") return NextResponse.json({ error: "publicRanking должен быть boolean" }, { status: 400 });
  if (body.calibration && Object.values(body.calibration).some(v => !Number.isInteger(v) || v < 1 || v > 3)) return NextResponse.json({ error: "Оценки калибровки должны быть от 1 до 3" }, { status: 400 });
  const profile = await saveProfile(body.profileId, body); if (!profile) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
  return NextResponse.json(profile);
}
