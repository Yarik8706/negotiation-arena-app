import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

if (!process.argv.includes("--confirm")) {
  console.error("Сброс не выполнен. Для явного подтверждения запустите: npm run demo:reset -- --confirm");
  process.exit(2);
}

const dataDir = path.join(process.cwd(), "data");
await mkdir(dataDir, { recursive: true });
for (const name of ["attempts.json", "group-rooms.json", "group-matchmaking.json"]) {
  const target = path.join(dataDir, name);
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, "[]\n", { encoding: "utf8", mode: 0o600 });
  await rename(temp, target);
  console.log(`Очищены данные: data/${name}`);
}
console.log("data/scenarios.json и сценарии в коде не изменялись.");
