import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import {spawn,spawnSync} from "node:child_process";
import {PrismaClient} from "@prisma/client";
import {chromium} from "playwright";
import lighthouse from "lighthouse";
import {launch} from "chrome-launcher";
const url=new URL(process.env.TEST_DATABASE_URL||"");if(!url.pathname.endsWith("_test"))throw Error("Separate test database required");
const schema="marketing_browser_"+crypto.randomBytes(6).toString("hex");url.searchParams.set("schema",schema);
const base="http://127.0.0.1:8915",env={...process.env,NODE_ENV:"test",DATABASE_URL:url.toString(),DB_MODE:"postgres",TENANT_FOUNDATION_ENABLED:"true",DEPLOYMENT_MODE:"hosted",PORT:"8915",SERVE_CLIENT:"true",HTTP_ACCESS_LOG:"off",SERVER_LOG_TO_FILE:"false",JWT_SECRET:crypto.randomBytes(32).toString("hex"),PUBLIC_SITE_URL:base,MARKETING_INDEX_ENABLED:"true",PUBLIC_LEADS_ENABLED:"true"};
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});let server,browser,chrome;
try {
 const deployed=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","apps/api/prisma/schema.prisma"],{env,encoding:"utf8"});assert.equal(deployed.status,0,deployed.stdout+deployed.stderr);
 server=spawn(process.execPath,["apps/api/src/index.js"],{env,stdio:["ignore","pipe","pipe"]});let errors="";server.stderr.on("data",chunk=>errors+=chunk);server.stdout.on("data",()=>{});
 for(let i=0;i<100;i++){try{if((await fetch(base+"/api/ready")).ok)break;}catch{}if(server.exitCode!==null)throw Error(errors);await new Promise(r=>setTimeout(r,250));}
 for(const route of ["/","/contact","/privacy","/terms","/login","/app/organizations"]){const response=await fetch(base+route),html=await response.text();const indexable=route==="/"||route==="/contact";assert.ok(html.includes(indexable?'content="index, follow"':'content="noindex, nofollow"'));assert.equal(response.headers.get("X-Robots-Tag"),indexable?null:"noindex, nofollow");if(indexable)assert.ok(html.includes('rel="canonical"'));}
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});const page=await browser.newPage({reducedMotion:"reduce"}),pageErrors=[],requested=[];page.on("pageerror",e=>pageErrors.push(e.message));page.on("request",r=>requested.push(r.url()));
 const screenshots=path.resolve("docs/validation/screenshots");await fs.mkdir(screenshots,{recursive:true});
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});await page.goto(base);await page.getByRole("heading",{level:1}).waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"Landing overflow "+width);assert.match(await page.getByRole("heading",{level:1}).evaluate(el=>getComputedStyle(el).fontFamily),/IRANYekan/);assert.equal(await page.getByRole("link",{name:"شروع استفاده",exact:true}).first().getAttribute("href"),"/signup");await page.screenshot({path:path.join(screenshots,"landing-"+width+".png"),fullPage:true});}
 assert.equal(requested.some(url=>/organization-app|tasks-panel|socket-vendor|accounting-view/.test(url)),false,"Public landing should not request private application chunks");
 await page.goto(base+"/contact?deployment=self_hosted");await page.getByLabel("نام درخواست‌کننده").fill("Synthetic browser request");await page.getByLabel("ایمیل یا شماره تماس").fill("browser@example.test");await page.getByLabel("نام سازمان درخواست‌کننده").fill("Synthetic company");assert.equal(await page.getByLabel("روش استقرار موردنیاز").inputValue(),"self_hosted");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"ثبت درخواست مشاوره"}).click();await page.getByRole("status").filter({hasText:"درخواست شما ثبت شد"}).waitFor();assert.equal(await db.publicLead.count(),1);
 await page.getByRole("button",{name:"ثبت درخواست مشاوره"}).click();await page.getByRole("status").filter({hasText:"درخواست شما ثبت شد"}).waitFor();assert.equal(await db.publicLead.count(),1,"Retry must not duplicate request");assert.deepEqual(pageErrors,[]);
 await browser.close();browser=null;
 chrome=await launch({chromePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,chromeFlags:["--headless","--no-first-run","--disable-extensions"]});
 let result=await lighthouse(base,{port:chrome.port,output:"json",onlyCategories:["performance","accessibility"],logLevel:"error"});
 if(result.lhr.runtimeError?.code==="NO_NAVSTART"){await fs.writeFile("docs/validation/lighthouse-trace-failure.json",result.report);await chrome.kill();chrome=await launch({chromePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,chromeFlags:["--headless","--no-first-run","--disable-extensions"]});result=await lighthouse(base,{port:chrome.port,output:"json",onlyCategories:["performance","accessibility"],logLevel:"error"});}
 assert.equal(result.lhr.runtimeError,undefined,"Lighthouse must record a valid navigation trace");
 await fs.writeFile("docs/validation/lighthouse-landing.json",result.report);
 const scores={performance:result.lhr.categories.performance.score*100,accessibility:result.lhr.categories.accessibility.score*100};console.log(JSON.stringify({browser:"passed",scores}));
 assert.ok(scores.performance>=90,"Landing performance >=90");assert.ok(scores.accessibility>=95,"Landing accessibility >=95");
} finally {if(chrome)await chrome.kill();if(browser)await browser.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once("exit",r));}await db.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');await db.$disconnect();}
