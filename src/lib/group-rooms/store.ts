import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { isDbConfigured } from "@/lib/db";
import { roomTransaction, roomReadTransaction, readRooms, writeRooms, readTickets, writeTickets } from "./database";

export type GroupTemplate = "client-seller" | "project-team" | "solo-board";
type Role = "seller" | "client" | "project-lead" | "analyst";
type Member = { id: string; name: string; role: Role; tokenHash: string; finished: boolean; joinedAt: string };
type Line = { id: string; authorId: string; author: string; role: string; content: string; createdAt: string; bot?: boolean };
export type Room = { id: string; code: string; template: GroupTemplate; status: "waiting" | "active" | "completed"; inviteHash: string; members: Member[]; lines: Line[]; createdAt: string; updatedAt: string };
const FILE = path.join(process.env.ARENA_DATA_DIR ?? path.join(process.cwd(), "data"), "group-rooms.json");
const MATCH_FILE = path.join(process.env.ARENA_DATA_DIR ?? path.join(process.cwd(), "data"), "group-matchmaking.json");
let queue: Promise<unknown> = Promise.resolve();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const safeEqual = (a: string, b: string) => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };
async function read(filter?: { id?: string; inviteHash?: string }): Promise<Room[]> { if (isDbConfigured()) return readRooms(filter); try { const value = JSON.parse(await fs.readFile(FILE, "utf8")); return Array.isArray(value) ? value : []; } catch { return []; } }
async function write(rooms: Room[]) { if (isDbConfigured()) return writeRooms(rooms); await fs.mkdir(path.dirname(FILE), { recursive: true }); const tmp = `${FILE}.${randomUUID()}.tmp`; await fs.writeFile(tmp, JSON.stringify(rooms, null, 2), { mode: 0o600 }); await fs.rename(tmp, FILE); }
export type MatchTicket = { id: string; tokenHash: string; name: string; createdAt: number; state: "waiting" | "matched"; roomId?: string; roomToken?: string; delivered?: boolean };
async function readMatches(): Promise<MatchTicket[]> { if (isDbConfigured()) return readTickets(); try { const value = JSON.parse(await fs.readFile(MATCH_FILE, "utf8")); return Array.isArray(value) ? value : []; } catch { return []; } }
async function writeMatches(items: MatchTicket[]) { if (isDbConfigured()) return writeTickets(items); await fs.mkdir(path.dirname(MATCH_FILE), { recursive: true }); const tmp = `${MATCH_FILE}.${randomUUID()}.tmp`; await fs.writeFile(tmp, JSON.stringify(items, null, 2), { mode: 0o600 }); await fs.rename(tmp, MATCH_FILE); }
function transaction<T>(fn: () => Promise<T>): Promise<T> { if (isDbConfigured()) return roomTransaction(fn); const next = queue.then(fn, fn); queue = next.then(() => undefined, () => undefined); return next; }
const roleName = (role: Role) => ({ seller: "Продавец", client: "Клиент", "project-lead": "Руководитель проекта", analyst: "Аналитик команды" })[role];
const slots: Record<GroupTemplate, Role[]> = { "client-seller": ["seller", "client"], "project-team": ["project-lead", "analyst"], "solo-board": ["project-lead"] };
const publicRoom = (room: Room, member: Member) => ({ id: room.id, code: room.code, template: room.template, status: room.status, createdAt: room.createdAt,
  brief: member.role === "seller" ? "Вы представляете продукт. Выясните задачу клиента и согласуйте небольшой пилот с критерием успеха, ответственными и датой проверки. Не обещайте неподтверждённые возможности." : member.role === "client" ? "Вы выбираете решение для команды. Важно показать руководству измеримый эффект в этом квартале, но у команды мало времени на внедрение. Раскройте приоритеты, если продавец задаёт вопросы." : member.role === "analyst" ? "Вы — аналитик команды. Ваша личная задача — проверить зависимости и критерии готовности первого этапа. Не подтверждайте срок без оценки ресурсов; согласуйте вместе с руководителем проекта ответственного и дату контрольной точки." : "Вы — руководитель проекта. Ваша задача — предложить заказчику реалистичный план с приоритетами и этапами. Обсуждайте варианты с аналитиком команды, прежде чем подтверждать объём или дату.",
  role: roleName(member.role), members: room.members.map((m) => ({ id: m.id, name: m.name, role: roleName(m.role), finished: m.finished })), lines: room.lines,
  report: room.status === "completed" ? buildReport(room) : null });
function buildReport(room: Room) {
  const humanLines = room.lines.filter((line) => !line.bot); const questions = humanLines.filter((line) => line.content.includes("?"));
  const commitments = humanLines.filter((line) => /ответствен|дата|зафикс|критери|следующ(?:ий|его) шаг/i.test(line.content));
  const teamAlign = room.template === "project-team" && room.members.filter((m) => ["project-lead", "analyst"].includes(m.role)).length === 2;
  const teamMessages = room.lines.filter((line) => !line.bot && room.members.some((member) => member.id === line.authorId));
  const teamDisagrees = teamMessages.some((line) => /не соглас|не поддержива|позиция отлич|не будем предлагать|это нереалистично/i.test(line.content));
  const teamAgrees = teamMessages.some((line) => /как команда|общая позиция|мы согласны|мы предлагаем|поддерживаю/i.test(line.content));
  return { outcome: commitments.length ? "Зафиксированы условия следующего шага" : "Сторонам нужно уточнить решение и обязательства", shared: [
    { quote: questions.at(0)?.content ?? "В диалоге пока не было уточняющего вопроса", theory: "Вопросы SPIN", insight: "Уточняющие вопросы помогают обсуждать интересы, а не только позиции." },
    { quote: commitments.at(-1)?.content ?? "Следующий шаг не зафиксирован", theory: "Фиксация договорённостей", insight: "Назовите действие, ответственного и дату проверки." },
  ], participants: room.members.map((member) => ({ name: member.name, role: roleName(member.role), notes: humanLines.filter((line) => line.authorId === member.id).slice(-2).map((line) => line.content), exercise: "В следующем раунде задайте вопрос об интересах до первого предложения и зафиксируйте следующий шаг." })), alignment: teamAlign ? teamDisagrees ? "В репликах замечены признаки разногласия внутри команды. Согласуйте общую позицию до следующего предложения." : teamAgrees ? "Участники явно обозначили общую позицию. Закрепите её общей формулировкой и ответственными." : "По репликам нельзя надёжно определить согласованность команды. Попробуйте явно проговорить общий план." : null };
}
function authenticate(room: Room, token: string): Member | null { const hash = digest(token); return room.members.find((m) => safeEqual(m.tokenHash, hash)) ?? null; }
export async function createRoom(template: GroupTemplate, name: string) {
  return transaction(async () => { const invite = randomBytes(24).toString("base64url"); const token = randomBytes(32).toString("base64url"); const role = slots[template][0]; const now = new Date().toISOString();
    const room: Room = { id: randomUUID(), code: randomBytes(4).toString("hex").toUpperCase(), template, status: template === "solo-board" ? "active" : "waiting", inviteHash: digest(invite), members: [{ id: randomUUID(), name, role, tokenHash: digest(token), finished: false, joinedAt: now }], lines: [], createdAt: now, updatedAt: now };
    const all = isDbConfigured() ? [] : await read(); all.push(room); await write(all); return { room: publicRoom(room, room.members[0]), token, invite };
  });
}
export async function joinRoom(invite: string, name: string) {
  return transaction(async () => { const all = await read({ inviteHash: digest(invite) }); const room = all.find((r) => safeEqual(r.inviteHash, digest(invite)) && r.status === "waiting"); if (!room) return null; const role = slots[room.template][room.members.length]; if (!role) return null;
    const token = randomBytes(32).toString("base64url"); const member: Member = { id: randomUUID(), name, role, tokenHash: digest(token), finished: false, joinedAt: new Date().toISOString() }; room.members.push(member);
    if (room.template === "project-team" || room.members.length === 2) room.status = "active"; room.updatedAt = new Date().toISOString(); await write(all); return { room: publicRoom(room, member), token };
  });
}
export async function getRoom(id: string, token: string) { const fn = async () => { const room = (await read({ id })).find((r) => r.id === id); if (!room) return null; const member = authenticate(room, token); return member ? publicRoom(room, member) : null; }; return isDbConfigured() ? roomReadTransaction(fn) : fn(); }
function botReplies(room: Room, line: string): Line[] { const low = line.toLowerCase(); const responses = room.template === "project-team" || room.template === "solo-board" ? [
  { name: "Руководитель", role: "Руководитель проекта", text: /приоритет|перв(?:ым|ым делом)|что важнее/.test(low) ? "Для запуска критична интеграция. Остальные отчёты можно перенести на следующий этап, если будет понятна дата проверки." : "Мне нужен реалистичный первый этап и ответственный за интеграцию. Как вы предлагаете распределить объём?" },
  { name: "Заказчик", role: "Заказчик", text: /этап|поэтап|контрольн|ответствен|дата/.test(low) ? "Такой план можно обсуждать. Зафиксируем критерий готовности первого этапа и дату контрольной встречи." : "Запуск связан с кампанией. Какие функции попадут в первую версию и как вы снизите риск задержки?" },
].map((item) => ({ ...item, text: item.text })) : [];
  return responses.map((response) => ({ id: randomUUID(), authorId: `bot-${response.name}`, author: response.name, role: response.role, content: response.text, createdAt: new Date().toISOString(), bot: true }));
}
export async function postLine(id: string, token: string, content: string) {
  return transaction(async () => { const all = await read({ id }); const room = all.find((r) => r.id === id); if (!room) return { error: "missing" as const }; const member = authenticate(room, token); if (!member) return { error: "denied" as const }; if (room.status !== "active") return { error: "inactive" as const };
    if (member.finished) return { error: "inactive" as const }; const lastHuman = [...room.lines].reverse().find((line) => !line.bot); if (room.template === "client-seller" && lastHuman?.authorId === member.id) return { error: "turn" as const };
    room.lines.push({ id: randomUUID(), authorId: member.id, author: member.name, role: roleName(member.role), content, createdAt: new Date().toISOString() }); if (room.template === "project-team" || room.template === "solo-board") room.lines.push(...botReplies(room, content)); room.updatedAt = new Date().toISOString(); await write(all); return { room: publicRoom(room, member) };
  });
}
export async function finishRoom(id: string, token: string) { return transaction(async () => { const all = await read({ id }); const room = all.find((r) => r.id === id); if (!room) return { error: "missing" as const }; const member = authenticate(room, token); if (!member) return { error: "denied" as const }; member.finished = true; if (room.members.every((m) => m.finished)) room.status = "completed"; room.updatedAt = new Date().toISOString(); await write(all); return { room: publicRoom(room, member) }; }); }
export async function enterMatchmaking(name: string) { return transaction(async () => {
  const matches = (await readMatches()).filter((ticket) => Date.now() - ticket.createdAt < 180_000);
  const waiting = matches.find((ticket) => ticket.state === "waiting");
  const id = randomUUID(), ticketToken = randomBytes(32).toString("base64url"), now = Date.now();
  const ticket: MatchTicket = { id, tokenHash: digest(ticketToken), name, createdAt: now, state: "waiting" };
  if (!waiting) { matches.push(ticket); await writeMatches(matches); return { ticketId: id, ticketToken, waiting: true }; }
  const rooms = isDbConfigured() ? [] : await read(); const invite = randomBytes(24).toString("base64url"); const playerTokens = [randomBytes(32).toString("base64url"), randomBytes(32).toString("base64url")]; const roomId = randomUUID(); const stamp = new Date(now).toISOString();
  const members: Member[] = [{ id: randomUUID(), name: waiting.name, role: "seller", tokenHash: digest(playerTokens[0]), finished: false, joinedAt: stamp }, { id: randomUUID(), name, role: "client", tokenHash: digest(playerTokens[1]), finished: false, joinedAt: stamp }];
  rooms.push({ id: roomId, code: randomBytes(4).toString("hex").toUpperCase(), template: "client-seller", status: "active", inviteHash: digest(invite), members, lines: [], createdAt: stamp, updatedAt: stamp }); await write(rooms);
  waiting.state = "matched"; waiting.roomId = roomId; waiting.roomToken = playerTokens[0];
  ticket.state = "matched"; ticket.roomId = roomId; ticket.roomToken = playerTokens[1]; matches.push(ticket); await writeMatches(matches);
  return { ticketId: id, ticketToken, waiting: false };
}); }
export async function pollMatchmaking(id: string, token: string) { return transaction(async () => { const matches = await readMatches(); const ticket = matches.find((item) => item.id === id && safeEqual(item.tokenHash, digest(token))); if (!ticket) return { error: "missing" as const }; if (Date.now() - ticket.createdAt >= 180_000) { await writeMatches(matches.filter((item) => item.id !== id)); return { error: "expired" as const }; } if (ticket.state === "waiting") return { waiting: true };
  if (!ticket.roomToken || !ticket.roomId || ticket.delivered) return { error: "expired" as const }; const result = { waiting: false, roomId: ticket.roomId, token: ticket.roomToken }; ticket.roomToken = undefined; ticket.delivered = true; await writeMatches(matches); return result;
}); }
export async function cancelMatchmaking(id: string, token: string) { return transaction(async () => { const matches = await readMatches(); const index = matches.findIndex((item) => item.id === id && safeEqual(item.tokenHash, digest(token))); if (index < 0) return { error: "missing" as const }; if (matches[index].state !== "waiting") return { error: "matched" as const }; matches.splice(index, 1); await writeMatches(matches); return { cancelled: true }; }); }
export async function resetGroupRooms() { return transaction(async () => { await read(); await write([]); await writeMatches([]); }); }

export async function deleteRoom(id: string, token: string) {
  return transaction(async () => {
    const rooms = await read({ id }), room = rooms.find((r) => r.id === id);
    if (!room || !authenticate(room, token)) return false;
    await writeMatches((await readMatches()).filter((t) => t.roomId !== id));
    await write(rooms.filter((r) => r.id !== id));
    return true;
  });
}
