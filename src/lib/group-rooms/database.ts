import { AsyncLocalStorage } from "node:async_hooks";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { withDbTransaction } from "@/lib/db";
import type { Room, MatchTicket } from "./store";

const context = new AsyncLocalStorage<{ db: PoolClient; rooms: Map<string, Room> }>();
function client() { const value = context.getStore(); if (!value) throw new Error("Room transaction required"); return value.db; }
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return createHash("sha256").update(secret).digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function decrypt(value: string) {
  const data = Buffer.from(value, "base64url"), cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8");
}
export function roomTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return withDbTransaction(async (db) => {
    // Short, DB-wide serialization protects invitation slots and matchmaking
    // across replicas. No network LLM call runs inside this lock.
    await db.query("SELECT pg_advisory_xact_lock(130132)");
    return context.run({ db, rooms: new Map() }, fn);
  });
}
export async function readRooms(filter?: { id?: string; inviteHash?: string }): Promise<Room[]> {
  const db = client();
  const rooms = filter?.id
    ? await db.query("SELECT * FROM group_rooms WHERE id::text=$1", [filter.id])
    : filter?.inviteHash
      ? await db.query("SELECT * FROM group_rooms WHERE invite_hash=$1 AND status='waiting'", [filter.inviteHash])
      : await db.query("SELECT * FROM group_rooms ORDER BY created_at,id");
  const ids = rooms.rows.map((r) => r.id);
  const members = await db.query("SELECT * FROM group_room_members WHERE room_id=ANY($1::uuid[]) ORDER BY joined_at, CASE role WHEN 'seller' THEN 0 WHEN 'project-lead' THEN 0 ELSE 1 END", [ids]);
  const messages = await db.query("SELECT * FROM group_room_messages WHERE room_id=ANY($1::uuid[]) ORDER BY sequence", [ids]);
  const result: Room[] = rooms.rows.map((r) => ({
    id: r.id, code: r.public_code, template: r.template, status: r.status, inviteHash: r.invite_hash,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    members: members.rows.filter((m) => m.room_id === r.id).map((m) => ({ id: m.id, name: m.display_name, role: m.role, tokenHash: m.access_token_hash, finished: m.finished, joinedAt: m.joined_at.toISOString() })),
    lines: messages.rows.filter((m) => m.room_id === r.id).map((m) => ({ id: m.id, authorId: m.author_member_id ?? `bot-${m.author_label}`, author: m.author_label, role: m.author_role, content: m.body, bot: m.is_bot, createdAt: m.created_at.toISOString() })),
  }));
  for (const room of result) context.getStore()!.rooms.set(room.id, structuredClone(room));
  return result;
}
export async function writeRooms(rooms: Room[]) {
  const db = client();
  const previous = context.getStore()!.rooms;
  const removed = [...previous.keys()].filter((id) => !rooms.some((r) => r.id === id));
  if (removed.length) await db.query("DELETE FROM group_rooms WHERE id=ANY($1::uuid[])", [removed]);
  for (const r of rooms) {
    const old = previous.get(r.id);
    if (old && JSON.stringify(old) === JSON.stringify(r)) continue;
    await db.query(`INSERT INTO group_rooms(id,public_code,template,status,invite_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`, [r.id,r.code,r.template,r.status,r.inviteHash,r.createdAt,r.updatedAt]);
    for (const m of r.members.filter((m) => !old?.members.some((before) => JSON.stringify(before) === JSON.stringify(m)))) await db.query(`INSERT INTO group_room_members(id,room_id,display_name,role,access_token_hash,finished,joined_at) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET finished=EXCLUDED.finished`, [m.id,r.id,m.name,m.role,m.tokenHash,m.finished,m.joinedAt]);
    for (const l of r.lines.filter((l) => !old?.lines.some((before) => before.id === l.id))) await db.query(`INSERT INTO group_room_messages(id,room_id,author_member_id,author_label,author_role,body,is_bot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`, [l.id,r.id,l.bot ? null : l.authorId,l.author,l.role,l.content,l.bot ?? false,l.createdAt]);
  }
}
export async function readTickets(): Promise<MatchTicket[]> {
  const { rows } = await client().query("SELECT * FROM group_matchmaking_tickets WHERE state IN ('waiting','matched') ORDER BY created_at,id");
  return rows.map((r) => ({ id:r.id,tokenHash:r.participant_search_token_hash,name:r.display_name,createdAt:r.created_at.getTime(),state:r.state,roomId:r.room_id ?? undefined,roomToken:r.room_token_cipher ? decrypt(r.room_token_cipher) : undefined,delivered:r.delivered }));
}
export async function writeTickets(tickets: MatchTicket[]) {
  const db = client();
  await db.query("DELETE FROM group_matchmaking_tickets WHERE NOT (id = ANY($1::uuid[]))", [tickets.map((t) => t.id)]);
  for (const t of tickets) await db.query(`INSERT INTO group_matchmaking_tickets(id,participant_search_token_hash,display_name,room_id,state,created_at,room_token_cipher,delivered) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(id) DO UPDATE SET room_id=EXCLUDED.room_id,state=EXCLUDED.state,room_token_cipher=EXCLUDED.room_token_cipher,delivered=EXCLUDED.delivered`, [t.id,t.tokenHash,t.name,t.roomId ?? null,t.state,new Date(t.createdAt),t.roomToken ? encrypt(t.roomToken) : null,t.delivered ?? false]);
}

export function roomReadTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return withDbTransaction(async (db) => {
    await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return context.run({ db, rooms:new Map() }, fn);
  });
}
