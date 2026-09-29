/** Run against a disposable Neon branch prepared through the Neon plugin. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env };
function merge(text) {
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}
merge(await readFile(path.join(root,".env.local"),"utf8"));
if (!process.env.ARENA_TEST_DB_ENV_FILE) throw new Error("Provide ARENA_TEST_DB_ENV_FILE for a disposable Neon branch; production is never the default.");
merge(await readFile(process.env.ARENA_TEST_DB_ENV_FILE,"utf8"));
env.NEXT_DIST_DIR = ".next-db-verify";
env.LLM_MOCK = "1";
env.ARENA_DATA_DIR = `/tmp/arena-db-verify-${randomUUID()}`;
const ports = [3211,3212];
const urls = ports.map((p) => `http://127.0.0.1:${p}`);
const children = new Map();
let logs = "";
const checks = [];
const profile = `local-${randomUUID()}`, other = `local-${randomUUID()}`;
const own = { "x-profile-id":profile }, foreign = { "x-profile-id":other };
const admin = { authorization:`Bearer ${env.ADMIN_API_TOKEN}` };
const rooms = new Map(), scenarioIds = [];
async function start(index) {
  const child = spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(ports[index])],{ cwd:root,env,stdio:["ignore","pipe","pipe"] });
  children.set(index,child);
  child.stdout.on("data",(b)=>{logs+=b.toString();}); child.stderr.on("data",(b)=>{logs+=b.toString();});
  for(let i=0;i<100;i++) { try { const r=await fetch(`${urls[index]}/api/health`);if(r.ok)return; }catch{} await new Promise(r=>setTimeout(r,200)); }
  throw new Error("Test server did not become ready");
}
async function stop(index) {
  const child=children.get(index);if(!child)return;
  await new Promise(resolve=>{child.once("exit",resolve);child.kill("SIGTERM");});children.delete(index);
}
async function api(index,route,{method="GET",headers={},body}={}) {
  const r=await fetch(`${urls[index]}${route}`,{method,headers:{...(body?{"content-type":"application/json"}:{}),...headers},body:body?JSON.stringify(body):undefined});
  const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:"non-JSON response"};}
  return {status:r.status,data,cookie:r.headers.get("set-cookie")};
}
function status(result,expected) {assert.equal(result.status,expected,result.data?.error ?? "HTTP status mismatch");return result.data;}
function check(name) {checks.push(name);console.log(`PASS ${name}`);}
function privacy(value) {for(const [k,v] of Object.entries(value??{})){assert.ok(!["systemPrompt","hiddenInterests","redLines","goals","constraints","baseScenario","profileId","tokenHash","inviteHash"].includes(k),`Private field ${k}`);if(v&&typeof v==="object")privacy(v);}}
async function createAttempt(mode="independent",previousAttemptId) {return status(await api(0,"/api/attempts",{method:"POST",headers:own,body:{scenarioId:"pilot-prospect",profileId:profile,practiceMode:mode,previousAttemptId}}),201);}
async function deleteTestData() {
  for(const [id,token] of rooms) await api(0,`/api/group-rooms/${id}`,{method:"DELETE",headers:{authorization:`Bearer ${token}`}});
  for(const id of scenarioIds) await api(0,`/api/scenarios?id=${id}`,{method:"DELETE",headers:admin});
  await api(0,`/api/progress?profileId=${profile}`,{method:"DELETE",headers:own});
  await api(0,`/api/progress?profileId=${other}`,{method:"DELETE",headers:foreign});
}
try {
  await start(0);await start(1);
  const catalog=status(await api(0,"/api/scenarios"),200);privacy(catalog);
  status(await api(0,"/api/scenarios?admin=1"),401);
  status(await api(0,"/api/scenarios",{method:"POST",body:{}}),401);
  const logged=await api(0,"/admin",{headers:admin});assert.equal(logged.status,200);assert.ok(logged.cookie?.includes("HttpOnly"));
  status(await api(0,"/api/scenarios?admin=1",{headers:{cookie:logged.cookie.split(";")[0]}}),200);
  status(await api(0,"/api/scenarios",{method:"POST",headers:{...admin,origin:"https://untrusted.example"},body:{}}),403);
  check("admin protection, session cookie, origin, catalog privacy");
  status(await api(0,"/api/progress",{method:"PUT",headers:own,body:{profileId:profile,alias:`DB verify ${profile.slice(-6)}`,publicRanking:true}}),200);
  status(await api(0,`/api/progress?profileId=${profile}`,{headers:foreign}),404);
  const attempt=await createAttempt();privacy(attempt);
  status(await api(1,`/api/attempts/${attempt.id}`,{headers:foreign}),404);
  status(await api(1,"/api/attempts/turn",{headers:foreign,method:"POST",body:{attemptId:attempt.id,text:"Чужая реплика"}}),404);
  status(await api(1,`/api/attempts/${attempt.id}/finish`,{headers:foreign,method:"POST"}),404);
  status(await api(0,"/api/attempts",{method:"POST",headers:foreign,body:{scenarioId:"pilot-prospect",profileId:other,previousAttemptId:attempt.id}}),404);
  status(await api(0,"/api/attempts/not-a-uuid",{headers:own}),404);
  const turns=await Promise.all([api(0,"/api/attempts/turn",{method:"POST",headers:own,body:{attemptId:attempt.id,text:"Какие приоритеты важны для вас?"}}),api(1,`/api/attempts/${attempt.id}/messages`,{method:"POST",headers:own,body:{text:"Предлагаю пилот, ответственный и дата проверки."}})]);
  turns.forEach(r=>status(r,200));
  const restored=status(await api(1,`/api/attempts/${attempt.id}`,{headers:own}),200);assert.equal(restored.messages.length,4);
  const finals=await Promise.all([api(0,"/api/attempts/complete",{method:"POST",headers:own,body:{attemptId:attempt.id}}),api(1,`/api/attempts/${attempt.id}/finish`,{method:"POST",headers:own})]);
  finals.forEach(r=>status(r,200));privacy(finals[0].data);privacy(finals[1].data);
  assert.deepEqual(finals[0].data.attempt.report,finals[1].data.report);
  status(await api(1,`/api/attempts/${attempt.id}/messages`,{method:"POST",headers:own,body:{text:"Продолжить"}}),409);
  const retry=await createAttempt("independent",attempt.id);assert.equal(retry.scenarioVersion,attempt.scenarioVersion);
  status(await api(0,`/api/attempts/${retry.id}/finish`,{method:"POST",headers:own}),200);
  check("owner access, concurrent turns, idempotent finish, immutable retry");
  const guided=await createAttempt("guided");status(await api(0,`/api/attempts/${guided.id}/finish`,{method:"POST",headers:own}),200);
  const progress=status(await api(1,`/api/progress?profileId=${profile}`,{headers:own}),200);assert.equal(progress.totalAttempts,3);assert.ok(progress.skills.some(s=>s.mode==="guided"));assert.ok(progress.skills.some(s=>s.mode==="independent"));
  const rankingRoute=`/api/leaderboard?scenarioId=pilot-prospect&scenarioVersion=${attempt.scenarioVersion}&difficulty=${encodeURIComponent(attempt.scenario.difficulty??"Средняя")}&mode=independent`;
  const alias=progress.profile.alias;
  assert.ok(status(await api(0,rankingRoute),200).rows.some(r=>r.alias===alias));
  privacy(status(await api(0,rankingRoute),200));
  status(await api(0,"/api/progress",{method:"PUT",headers:own,body:{profileId:profile,publicRanking:false}}),200);
  assert.ok(!status(await api(1,rankingRoute),200).rows.some(r=>r.alias===alias));
  const ranked=status(await api(1,rankingRoute+"&period="+new Date().toISOString().slice(0,7),{headers:own}),200);
  assert.equal(ranked.ownPosition,null);
  status(await api(0,"/api/progress",{method:"PUT",headers:own,body:{profileId:profile,publicRanking:true}}),200);
  assert.ok(status(await api(1,rankingRoute,{headers:own}),200).ownPosition.rank>=1);
  assert.equal(status(await api(0,rankingRoute+"&period=2000-01"),200).rows.length,0);
  status(await api(0,rankingRoute+"&period=invalid"),400);
  check("persistent progress, mode separation, ranking consent, period, own position and privacy");
  const room=status(await api(0,"/api/group-rooms",{method:"POST",body:{action:"create",template:"client-seller",name:"DB creator"}}),201);rooms.set(room.room.id,room.token);
  const joins=await Promise.all([api(0,"/api/group-rooms",{method:"POST",body:{action:"join",invite:room.invite,name:"DB guest A"}}),api(1,"/api/group-rooms",{method:"POST",body:{action:"join",invite:room.invite,name:"DB guest B"}})]);
  assert.deepEqual(joins.map(r=>r.status).sort(),[201,404]);
  const guest=joins.find(r=>r.status===201).data;
  status(await api(1,`/api/group-rooms/${room.room.id}`,{headers:{authorization:"Bearer wrong"}}),404);
  privacy(status(await api(1,`/api/group-rooms/${room.room.id}`,{headers:{authorization:`Bearer ${room.token}`}}),200));
  status(await api(0,`/api/group-rooms/${room.room.id}/messages`,{method:"POST",headers:{authorization:`Bearer ${room.token}`},body:{text:"Что важно для вас?"}}),200);
  status(await api(1,`/api/group-rooms/${room.room.id}/messages`,{method:"POST",headers:{authorization:`Bearer ${room.token}`},body:{text:"Ещё один ход"}}),409);
  status(await api(1,`/api/group-rooms/${room.room.id}/messages`,{method:"POST",headers:{authorization:`Bearer ${guest.token}`},body:{text:"Важно проверить результат пилота."}}),200);
  const team=status(await api(1,"/api/group-rooms",{method:"POST",body:{action:"create",template:"solo-board",name:"DB solo"}}),201);rooms.set(team.room.id,team.token);
  const teamTurns=await Promise.all(urls.map((_,i)=>api(i,`/api/group-rooms/${team.room.id}/messages`,{method:"POST",headers:{authorization:`Bearer ${team.token}`},body:{text:`Этап ${i+1}, ответственный и дата проверки.`}})));
  teamTurns.forEach(r=>status(r,200));
  assert.equal(status(await api(0,`/api/group-rooms/${team.room.id}`,{headers:{authorization:`Bearer ${team.token}`}}),200).lines.length,6);
  check("cross-process invitation race, room access, turn order, concurrent bot room");
  const tickets=await Promise.all(urls.map((_,i)=>api(i,"/api/group-rooms",{method:"POST",body:{action:"matchmake",name:`DB search ${i}`}})));
  tickets.forEach(r=>status(r,201));
  const delivery=[];
  for(let i=0;i<2;i++){
    const t=tickets[i].data;
    const polls=await Promise.all(urls.map((_,j)=>api(j,`/api/group-matchmaking/${t.ticketId}`,{headers:{authorization:`Bearer ${t.ticketToken}`}})));
    assert.deepEqual(polls.map(r=>r.status).sort(),[200,404]);const result=polls.find(r=>r.status===200).data;delivery.push(result);rooms.set(result.roomId,result.token);
  }
  assert.equal(delivery[0].roomId,delivery[1].roomId);
  const waiting=status(await api(0,"/api/group-rooms",{method:"POST",body:{action:"matchmake",name:"DB cancel"}}),201);
  status(await api(1,`/api/group-matchmaking/${waiting.ticketId}`,{method:"DELETE",headers:{authorization:`Bearer ${waiting.ticketToken}`}}),200);
  check("atomic matchmaking, one-time encrypted delivery, cancellation");
  const originals=status(await api(0,"/api/scenarios?admin=1",{headers:admin}),200);
  const draft={...originals.find(s=>s.id==="pilot-prospect"),id:`db-verify-${randomUUID()}`,title:"DB test draft",status:"draft"};scenarioIds.push(draft.id);
  status(await api(0,"/api/scenarios",{method:"POST",headers:admin,body:draft}),200);
  status(await api(1,`/api/scenarios/${draft.id}`),404);
  status(await api(0,"/api/attempts",{method:"POST",headers:own,body:{scenarioId:draft.id,profileId:profile,preview:true}}),403);
  const preview=status(await api(0,"/api/attempts",{method:"POST",headers:{...own,...admin},body:{scenarioId:draft.id,profileId:profile,preview:true}}),201);
  status(await api(1,"/api/scenarios",{method:"POST",headers:admin,body:{...draft,status:"published"}}),200);
  assert.ok(status(await api(0,`/api/scenarios/${draft.id}`),200).version>preview.scenarioVersion);
  const old=status(await api(1,`/api/attempts/${preview.id}`,{headers:own}),200);assert.equal(old.scenarioVersion,preview.scenarioVersion);
  check("protected scenario draft, preview, publication, saved version snapshot");
  await stop(0);await start(0);
  assert.equal(status(await api(0,`/api/attempts/${attempt.id}`,{headers:own}),200).messages.length,4);
  assert.equal(status(await api(0,`/api/group-rooms/${room.room.id}`,{headers:{authorization:`Bearer ${room.token}`}}),200).lines.length,2);
  assert.equal(status(await api(0,`/api/progress?profileId=${profile}`,{headers:own}),200).totalAttempts,3);
  check("attempt, room and progress restore after process restart");
  status(await api(0,`/api/attempts/${guided.id}`,{method:"DELETE",headers:foreign}),404);
  status(await api(1,`/api/attempts/${guided.id}`,{method:"DELETE",headers:own}),200);
  status(await api(0,`/api/attempts/${guided.id}`,{headers:own}),404);
  if (process.env.ARENA_BROWSER_VERIFY === "1") {
    const { verifyBrowser } = await import("./verify-database-browser.mjs");
    await verifyBrowser({base:urls[0],profile,alias,difficulty:attempt.scenario.difficulty??"Средняя"});check("browser acceptance and fresh responsive screenshots");
  }
  status(await api(1,`/api/progress?profileId=${profile}&scope=history`,{method:"DELETE",headers:own}),200);
  const empty=status(await api(0,`/api/progress?profileId=${profile}`,{headers:own}),200);assert.equal(empty.totalAttempts,0);assert.equal(empty.profile.alias,alias);
  await deleteTestData();
  assert.equal(status(await api(1,`/api/progress?profileId=${profile}`,{headers:own}),200).totalAttempts,0);
  status(await api(1,`/api/group-rooms/${room.room.id}`,{headers:{authorization:`Bearer ${room.token}`}}),404);
  check("owner deletion and shared-room erasure");
  const report={date:new Date().toISOString(),result:"passed",checks,servers:ports,mode:"Neon disposable branch + deterministic mock"};
  await mkdir("docs/verification",{recursive:true});await writeFile("docs/verification/database-integration.json",JSON.stringify(report,null,2)+"\n");
} catch(error) {
  console.error(error.message);
  // Never emit connection strings or bearer credentials from server logs.
  const safe=logs.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,"[database credential]").replaceAll(env.ADMIN_API_TOKEN??"__unset__","[admin credential]").replaceAll(env.SESSION_SECRET??"__unset__","[session secret]");
  console.error(safe.slice(-5000));process.exitCode=1;
} finally {
  if(children.has(0))try{await deleteTestData();}catch{}
  await Promise.all([...children.keys()].map(stop));
}
