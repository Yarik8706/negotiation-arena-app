import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const env={...process.env};
for(const line of (await readFile(".env.local","utf8")).split("\n")){const m=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,"$2");}
for(const key of ["DATABASE_URL","POSTGRES_URL","DATABASE_URL_UNPOOLED","POSTGRES_URL_NON_POOLING","GROQ_API_KEY"])env[key]="";
env.LLM_MOCK="1";env.NEXT_DIST_DIR=".next-db-verify";env.ARENA_DATA_DIR=`/tmp/arena-local-verify-${randomUUID()}`;
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3213","-H","127.0.0.1"],{env,stdio:"ignore"});
try {
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:3213/api/health")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!ready)throw new Error("Demo server unavailable");
 const child=spawn(process.execPath,["scripts/smoke.mjs"],{env:{...env,BASE_URL:"http://127.0.0.1:3213",SMOKE_ADMIN_TOKEN:env.ADMIN_API_TOKEN},stdio:"inherit"});
 const code=await new Promise(r=>child.once("exit",r));if(code!==0)throw new Error("Local demo smoke failed");
 await mkdir("docs/verification",{recursive:true});await writeFile("docs/verification/local-demo.json",JSON.stringify({date:new Date().toISOString(),result:"passed",mode:"one process, isolated JSON directory, no database or LLM key"},null,2)+"\n");
}finally{await new Promise(r=>{server.once("exit",r);server.kill("SIGTERM");});}
