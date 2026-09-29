/** Prepare an additive SQL batch to apply with the Neon plugin; never connects. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const output = process.argv[2];
if (!output) throw new Error("Usage: node scripts/prepare-json-import.mjs /private/tmp/arena-import.json");
const quote = (value) => `'${String(value).replaceAll("'","''")}'`;
const payload = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const statements=[],counts={scenarios:0,attempts:0,profiles:0,rooms:0};
async function rows(name) {try {const v=JSON.parse(await readFile(path.join(process.cwd(),"data",name+".json"),"utf8"));if(!Array.isArray(v))throw new Error("Expected array");return v;} catch(e){if(e.code==="ENOENT")return [];throw e;}}
for(const s of await rows("scenarios")) {
  if(!s.id||!s.opponent||!s.title)throw new Error("Invalid local scenario");
  statements.push(`INSERT INTO scenarios(id,payload,version,updated_at) VALUES(${quote(s.id)},${payload(s)},${Number(s.version??1)},${quote(s.updatedAt??new Date().toISOString())}::timestamptz) ON CONFLICT(id) DO NOTHING`);counts.scenarios++;
}
for(const a of await rows("attempts")) {
  if(!/^[a-f0-9-]{36}$/i.test(a.id??"")||!a.scenarioId||!["active","completed"].includes(a.status))throw new Error("Invalid local attempt");
  statements.push(`INSERT INTO attempts(id,scenario_id,payload,status,created_at,updated_at) VALUES(${quote(a.id)}::uuid,${quote(a.scenarioId)},${payload(a)},${quote(a.status)},${quote(a.createdAt)}::timestamptz,${quote(a.updatedAt)}::timestamptz) ON CONFLICT(id) DO NOTHING`);counts.attempts++;
}
for(const p of await rows("profiles")) {
  if(!p.id)throw new Error("Invalid profile");
  statements.push(`INSERT INTO profiles(id,payload,updated_at) VALUES(${quote(p.id)},${payload(p)},${quote(p.updatedAt)}::timestamptz) ON CONFLICT(id) DO NOTHING`);counts.profiles++;
}
// Existing rooms use one-way credential hashes and can be imported unchanged.
// Ignore expired matchmaking: its one-time delivery credentials must not be copied.
for(const r of await rows("group-rooms")) {
  statements.push(`INSERT INTO group_rooms(id,public_code,template,status,invite_hash,created_at,updated_at) VALUES(${quote(r.id)}::uuid,${quote(r.code)},${quote(r.template)},${quote(r.status)},${quote(r.inviteHash)},${quote(r.createdAt)}::timestamptz,${quote(r.updatedAt)}::timestamptz) ON CONFLICT(id) DO NOTHING`);
  for(const m of r.members)statements.push(`INSERT INTO group_room_members(id,room_id,display_name,role,access_token_hash,finished,joined_at) SELECT ${quote(m.id)}::uuid,${quote(r.id)}::uuid,${quote(m.name)},${quote(m.role)},${quote(m.tokenHash)},${Boolean(m.finished)},${quote(m.joinedAt)}::timestamptz WHERE NOT EXISTS(SELECT 1 FROM group_room_members WHERE room_id=${quote(r.id)}::uuid AND role=${quote(m.role)}) ON CONFLICT(id) DO NOTHING`);
  for(const l of r.lines)statements.push(`INSERT INTO group_room_messages(id,room_id,author_member_id,author_label,author_role,body,is_bot,created_at) VALUES(${quote(l.id)}::uuid,${quote(r.id)}::uuid,${l.bot?"NULL":quote(l.authorId)+"::uuid"},${quote(l.author)},${quote(l.role)},${quote(l.content)},${Boolean(l.bot)},${quote(l.createdAt)}::timestamptz) ON CONFLICT(id) DO NOTHING`);
  counts.rooms++;
}
await writeFile(output,JSON.stringify({counts,statements},null,2)+"\n",{mode:0o600});
console.log(JSON.stringify({output,counts,policy:"insert missing IDs; preserve database rows and local files"}));
