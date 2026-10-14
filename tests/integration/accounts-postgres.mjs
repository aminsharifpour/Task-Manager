import assert from "node:assert/strict";
import crypto from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {PrismaClient} from "@prisma/client";
const url=new URL(process.env.TEST_DATABASE_URL||"");if(!url.pathname.endsWith("_test"))throw Error("Separate _test database required");const schema="accounts_"+crypto.randomBytes(6).toString("hex");url.searchParams.set("schema",schema);
const env={...process.env,NODE_ENV:"test",DB_MODE:"postgres",DATABASE_URL:url.toString(),TENANT_FOUNDATION_ENABLED:"true",DEPLOYMENT_MODE:"hosted",PORT:"8906",SERVE_CLIENT:"false",JWT_SECRET:"synthetic-accounts-private-key",HTTP_ACCESS_LOG:"off",SERVER_LOG_TO_FILE:"false",PLATFORM_OPERATOR_USER_IDS:"operator"};
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});const base="http://127.0.0.1:8906";let server;
const call=async(route,token="",method="GET",body,status=200)=>{const response=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
const start=async(mode)=>{server=spawn(process.execPath,["apps/api/src/index.js"],{env:{...env,DEPLOYMENT_MODE:mode},stdio:["ignore","pipe","pipe"]});let errors="";server.stderr.on("data",chunk=>{errors+=chunk;process.stderr.write(chunk);});server.stdout.on("data",()=>{});for(let i=0;i<80;i++){try{if((await fetch(base+"/api/ready")).ok)return;}catch{}if(server.exitCode!==null)throw Error(errors);await new Promise(r=>setTimeout(r,250));}throw Error("Server readiness timeout");};
const stop=async()=>{if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once("exit",r));}};
const body={fullName:"Synthetic Owner",phone:"09000005000",email:"owner@example.test",password:"synthetic-account-password",organizationName:"Synthetic organization"};
try{
 const deployed=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","apps/api/prisma/schema.prisma"],{env,encoding:"utf8"});assert.equal(deployed.status,0,deployed.stdout+deployed.stderr);
 await start("self_hosted");assert.equal((await call("/api/product-config")).needsSetup,true);await call("/api/auth/signup","","POST",body,403);
 await call("/api/auth/setup","","POST",{...body,password:" ".repeat(12)},400);await call("/api/auth/setup","","POST",{...body,password:"ی".repeat(40)},400);assert.equal(await db.user.count(),0);
 const setup=await call("/api/auth/setup","","POST",body);assert.equal((await call("/api/product-config")).needsSetup,false);await call("/api/auth/setup","","POST",body,409);
 const org=(await call("/api/organizations",setup.token))[0];const route="/api/organizations/"+org.id;
 await call(route+"/settings",setup.token,"PATCH",{calendar:"gregorian",timezone:"Etc/UTC",name:"Updated"});await call(route+"/settings",setup.token,"PATCH",{timezone:"fake/zone"},400);
 await call(route+"/entitlements",setup.token,"PUT",{expectedVersion:0,planCode:"local",activeMemberLimit:2,storageByteLimit:"1000",allowedModules:{chat:false}});assert.equal((await call(route+"/module-settings",setup.token)).modules.chat,false);
 await stop();await start("hosted");assert.equal((await call("/api/product-config")).publicSignupEnabled,true);await call(route+"/entitlements",setup.token,"PUT",{expectedVersion:1,planCode:"illegal",activeMemberLimit:100,storageByteLimit:"1000",allowedModules:{}},403);
 const invite=await call(route+"/invitations",setup.token,"POST",{email:"guest@example.test",role:"guest"},201);
 const guestBody={...body,phone:"09000005001",email:"guest@example.test",invitationToken:invite.token};const guest=await call("/api/auth/signup","","POST",guestBody);assert.equal((await call("/api/organizations",guest.token))[0].id,org.id);assert.equal(await db.organization.count(),1);
 await call("/api/auth/signup","","POST",guestBody,409);await call(route+"/settings",guest.token,"GET",undefined,403);
 const full=await call(route+"/invitations",setup.token,"POST",{email:"full@example.test"},201);await call("/api/auth/signup","","POST",{...body,phone:"09000005002",email:"full@example.test",invitationToken:full.token},409);assert.equal(await db.user.count({where:{phone:"09000005002"}}),0);
 const revoke=await call(route+"/invitations",setup.token,"POST",{email:"revoked@example.test"},201);await call(route+"/invitations/"+revoke.id,setup.token,"DELETE");await call("/api/auth/signup","","POST",{...body,phone:"09000005003",email:"revoked@example.test",invitationToken:revoke.token},404);
 const invites=await call(route+"/invitations",setup.token);assert.equal(invites.total,3);assert.equal("tokenHash" in invites.items[0],false);
 await call("/api/auth/signup","","POST",{...body,phone:"09000005004",email:"operator@example.test"});
 // Operator identity is configured explicitly; use a separate preconfigured user to avoid rewriting foreign keys.
 const bcrypt=(await import("bcryptjs")).default;await db.user.upsert({where:{id:"operator"},create:{id:"operator",phone:"09000005005",fullName:"Synthetic operator",passwordHash:"bcrypt$"+bcrypt.hashSync("synthetic-operator-password",10)},update:{}});
 const operator=(await call("/api/auth/login","","POST",{phone:"09000005005",password:"synthetic-operator-password"})).token;
 assert.equal((await call("/api/account",operator)).isOperator,true);assert.equal((await call("/api/operations/organizations",operator)).total,2);await call(route+"/projects",operator,"GET",undefined,404);
 await call("/api/operations/organizations/"+org.id+"/entitlements",operator,"PUT",{expectedVersion:1,planCode:"manual-test",activeMemberLimit:10,storageByteLimit:"10000",allowedModules:{tasks:false}});await call(route+"/projects",setup.token,"POST",{name:"Plan bypass",templateId:"software"},403);assert.equal(await db.entitlementChange.count(),2);
 await call("/api/account",guest.token,"PATCH",{currentPassword:body.password,password:"ی".repeat(40)},400);await call("/api/account",guest.token);
 await call("/api/account",guest.token,"PATCH",{currentPassword:"wrong",password:"synthetic-new-password"},403);await call("/api/account",guest.token,"PATCH",{currentPassword:body.password,password:"synthetic-new-password"});await call("/api/account",guest.token,"GET",undefined,401);
 const relog=(await call("/api/auth/login","","POST",{phone:guestBody.phone,password:"synthetic-new-password"})).token;const sessions=await call("/api/account/sessions",relog);assert.equal(sessions.length,1);await call("/api/account/sessions/all",relog,"DELETE");await call("/api/account",relog,"GET",undefined,401);
 assert.ok(await db.rateLimitCounter.count()>0);console.log("Accounts PostgreSQL passed: single-use setup, hosted signup, atomic invited registration, capacity/revocation, persistent limits, organization settings, operator-only entitlements and password/session revocation.");
}finally{await stop();await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await db.$disconnect();}
