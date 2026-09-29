import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function verifyBrowser({base,profile,alias,difficulty}) {
  const {chromium}=require(process.env.ARENA_PLAYWRIGHT_PACKAGE || "/Users/yaroslav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  const browser=await chromium.launch({headless:true,...(process.env.ARENA_BROWSER_EXECUTABLE ? {executablePath:process.env.ARENA_BROWSER_EXECUTABLE} : {channel:process.env.ARENA_BROWSER_CHANNEL || "chrome"})});
  const evidence=[];
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const dir=path.join(process.cwd(),"screenshots",date);await mkdir(dir,{recursive:true});
  const suffix=Date.now();
  const access={name:"arena-progress-access.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"arena-progress-access",version:1,profileId:profile}))};
  async function capture(page,label,heading) {
    const target=label.includes("import-error") ? page.getByText("Не удалось подключить прогресс.",{exact:false}) : page.getByRole("heading",{name:heading,exact:true});
    await target.evaluate(element=>element.scrollIntoView({block:"start"}));
    await page.evaluate(()=>window.scrollBy(0,-90));
    const dimensions=await page.evaluate(()=>({innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.equal(dimensions.scrollWidth,dimensions.clientWidth,`Overflow ${label}`);
    const output=path.join(dir,`db-${label}-${dimensions.innerWidth}x${dimensions.innerHeight}-${suffix}.png`);
    await page.screenshot({path:output,fullPage:false});evidence.push({path:output,...dimensions});
  }
  try {
    const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base+"/progress");await page.addStyleTag({content:"*{scroll-behavior:auto!important}"});await page.getByRole("heading",{name:"Прогресс на другом устройстве"}).waitFor();
    await page.getByLabel("Файл доступа к прогрессу").setInputFiles(access);
    await page.getByText("Прогресс подключён.",{exact:false}).waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Псевдоним"}).inputValue(),alias);
    await capture(page,"progress-versioned-skills-desktop","Навыки");
    await capture(page,"progress-transfer-desktop","Прогресс на другом устройстве");
    await page.getByLabel("Сценарий",{exact:true}).selectOption("pilot-prospect");
    await page.getByLabel("Сложность",{exact:true}).selectOption(difficulty);
    await page.getByRole("button",{name:"Показать рейтинг"}).click();
    try { await page.getByText("Ваша позиция:",{exact:false}).waitFor({timeout:10000}); }
    catch(error) {await capture(page,"ranking-failure-desktop","Лидерборд сценария");throw error;}
    await capture(page,"progress-rating-period-desktop","Лидерборд сценария");
    await page.getByLabel("Период рейтинга").selectOption(new Date().toISOString().slice(0,7));
    await page.getByRole("button",{name:"Показать рейтинг"}).click();
    const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Сохранить файл доступа"}).click();const download=await downloadPromise;
    const file=path.join("/tmp",`arena-browser-access-${suffix}.json`);await download.saveAs(file);
    const second=await browser.newContext({viewport:{width:390,height:844}});const mobile=await second.newPage();await mobile.goto(base+"/progress");await mobile.addStyleTag({content:"*{scroll-behavior:auto!important}"});await mobile.getByLabel("Файл доступа к прогрессу").waitFor();
    await mobile.getByLabel("Файл доступа к прогрессу").setInputFiles(file);await mobile.getByText("Прогресс подключён.",{exact:false}).waitFor();
    assert.equal(await mobile.getByRole("textbox",{name:"Псевдоним"}).inputValue(),alias);
    await capture(mobile,"progress-versioned-skills-mobile","Навыки");
    await capture(mobile,"progress-versioned-history-mobile","История попыток");
    await capture(mobile,"progress-transfer-mobile","Прогресс на другом устройстве");
    await mobile.getByLabel("Сценарий",{exact:true}).selectOption("pilot-prospect");await mobile.getByLabel("Сложность",{exact:true}).selectOption(difficulty);await mobile.getByRole("button",{name:"Показать рейтинг"}).click();await mobile.getByText("Ваша позиция:",{exact:false}).waitFor();
    await capture(mobile,"progress-ranking-mobile","Лидерборд сценария");
    await mobile.setViewportSize({width:320,height:844});await capture(mobile,"progress-transfer-narrow","Прогресс на другом устройстве");await capture(mobile,"progress-ranking-narrow","Лидерборд сценария");
    await mobile.getByLabel("Файл доступа к прогрессу").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from("{}")});await mobile.getByText("Не удалось подключить прогресс.",{exact:false}).waitFor();
    await capture(mobile,"progress-import-error-narrow","Псевдоним и публичный рейтинг");
    await mobile.setViewportSize({width:390,height:844});
    const toggle=mobile.getByRole("button",{name:/тёмн|темн|dark|светл/i});
    if(await toggle.count()){await toggle.first().click();await capture(mobile,"progress-transfer-alternate-theme-mobile","Прогресс на другом устройстве");}
    mobile.once("dialog",d=>d.accept());await mobile.getByRole("button",{name:"Удалить историю",exact:true}).click();await mobile.getByText("История попыток и отчёты удалены.",{exact:false}).waitFor();
    await capture(mobile,"progress-erased-history-mobile","История попыток");
    assert.equal(await mobile.getByRole("textbox",{name:"Псевдоним"}).inputValue(),alias);
    assert.deepEqual(errors,[]);
    await mkdir("docs/verification",{recursive:true});await writeFile("docs/verification/database-browser.json",JSON.stringify({result:"passed",date:new Date().toISOString(),checks:["export/import access into separate browser context","restore alias and progress","period and own rating position","invalid-file error","delete history while preserving profile"],evidence},null,2)+"\n");
    console.log("PASS browser transfer, ranking, errors, deletion and responsive evidence");
  }finally{await browser.close();}
}
