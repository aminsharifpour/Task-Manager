// API contract tests with scoped database/service mocks, not PostgreSQL integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../../apps/api/src/modules/tasks/record-reader.js',import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function setup({role='admin',denied=false,editable=true,editError,task:extra={},items=[]}={}){
 const current={organizationId:'orgA',userId:'u1',role},calls=[];
 const visible={organizationId:'orgA',OR:[{assignerId:'u1'}]};
 const task={id:'t1',assignerId:'u1',assigneePrimaryId:'u2',assigneeSecondaryId:null,parentTaskId:'parent',version:2,
  workflowSteps:[{id:'s1',assigneeMemberId:'u2'}],workflowPendingAssigneeIds:['u2'],
  project:{id:'p1',name:'Project',ownerId:'u1',customFieldDefinitions:[],members:[{userId:'private-member-id'}],internal:'not exposed'},...extra};
 const tx={
  organizationMembership:{async findMany(query){calls.push(['people',query]);return [{userId:'u1',user:{fullName:'First'}},{userId:'u2',user:{fullName:'Second'}}];}},
  taskChecklistItem:{async findMany(query){calls.push(['checklist',query]);return []; }},
  taskDependency:{async findMany(query){calls.push(['dependencies',query]);return []; }},
  task:{async findFirst(query){calls.push(['parent',query]);return null;}},
 };
 const dependencies={
  './service.js':{
   async getTask(c,id,transaction){calls.push(['getTask',c,id,transaction===tx]);assert.strictEqual(c,current);if(denied)throw Object.assign(new Error('Denied'),{code:'PERMISSION_DENIED'});return task;},
   assertEditable(c,t){calls.push(['editable',c,t.id]);if(editError)throw editError;if(!editable)throw Object.assign(new Error('No edit'),{code:'PERMISSION_DENIED'});},
   visibleTasks(c){assert.strictEqual(c,current);return visible;},
  },
  '../shared/scoped.js':{
   async readScoped(c,module,fn){calls.push(['scope',c,module]);assert.equal(module,'tasks');return fn(tx,current);},
   async pageRows(model,where,query,options,transaction){assert.strictEqual(transaction,tx);calls.push(['page',model,where,query,options]);return {items,total:87,page:Number(query.page||1),pageSize:25};},
  },
 };
 const result=ts.transpileModule(source,{fileName:'record-reader.js',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}});
 const m={exports:{}};vm.runInNewContext(result.outputText,{exports:m.exports,module:m,require:name=>{assert.ok(dependencies[name],name);return dependencies[name];},Error,console});
 return {readers:m.exports,calls,current,tx};
}
for(const name of ['recordDetails','recordComments','recordActivity','recordChildren']){
 test(name+' enforces visible record access before reading related data',async()=>{const h=setup({denied:true});await assert.rejects(h.readers[name]({organizationId:'spoofed'},'t1',{page:1}));assert.equal(h.calls.filter(c=>['page','people','parent','dependencies','checklist'].includes(c[0])).length,0);});
}
test('detail uses fresh scoped context and retains the existing response contract',async()=>{
 const h=setup(),d=await h.readers.recordDetails({organizationId:'stale'},'t1');assert.equal(d.canEdit,true);assert.equal(d.task.id,'t1');
 assert.deepEqual(Object.keys(d.task.project).sort(),['customFieldDefinitions','id','name']);assert.equal(d.parent,null);assert.equal(d.people[1].fullName,'Second');
 for(const name of ['checklist','dependencies','parent'])assert.equal(h.calls.find(c=>c[0]===name)[1].where.organizationId,'orgA');
 const dependency=h.calls.find(c=>c[0]==='dependencies')[1];assert.equal(dependency.where.dependsOn.is.organizationId,'orgA');
 const people=h.calls.find(c=>c[0]==='people')[1];assert.equal(people.where.organizationId,'orgA');assert.deepEqual(plain(people.select),{userId:true,user:{select:{fullName:true}}});
});
test('guest detail can never acquire core edit permission',async()=>{const h=setup({role:'guest'}),d=await h.readers.recordDetails({},'t1');assert.equal(d.canEdit,false);assert.equal(h.calls.filter(c=>c[0]==='editable').length,0);});
test('forbidden edit remains read-only and unexpected authorization failures propagate',async()=>{
 const h=setup({editable:false});assert.equal((await h.readers.recordDetails({},'t1')).canEdit,false);
 await assert.rejects(setup({editError:new Error('Database issue')}).readers.recordDetails({},'t1'),/Database issue/);
});
test('comment pages preserve total and enrich authors without a global directory read',async()=>{
 const h=setup({items:[{id:'c1',authorId:'u2',text:'Comment',stepId:'general'}]}),data=await h.readers.recordComments({},'t1',{page:3});
 assert.equal(data.items[0].author.fullName,'Second');assert.equal(data.total,87);assert.equal(data.page,3);
 const query=h.calls.find(c=>c[0]==='page');assert.equal(query[1],'taskWorkflowComment');assert.deepEqual(plain(query[2]),{organizationId:'orgA',taskId:'t1'});
});
test('unknown former author remains null instead of an invented name',async()=>{const h=setup({items:[{id:'c1',authorId:'gone',text:'Text'}]});const data=await h.readers.recordComments({},'t1',{});assert.equal(data.items[0].author.fullName,null);});
test('activity pages never request hashes/idempotency keys/result snapshots',async()=>{
 const h=setup({items:[{id:'e1',actorUserId:'u2',decision:'approve'}]}),d=await h.readers.recordActivity({},'t1',{page:2});assert.equal(d.items[0].actorName,'Second');
 const select=h.calls.find(c=>c[0]==='page')[4].select;assert.deepEqual(Object.keys(select).sort(),['actorUserId','createdAt','decision','fromStep','id','toStep']);
});
test('children use both visibility scope and requested parent, with pagination',async()=>{
 const h=setup();await h.readers.recordChildren({},'t1',{page:4});const call=h.calls.find(c=>c[0]==='page');assert.equal(call[1],'task');assert.equal(call[2].parentTaskId,'t1');assert.equal(call[2].organizationId,'orgA');assert.ok(call[2].OR);assert.equal(call[3].page,4);
});
test('router only replaces detail/comment reads and adds read-only endpoints',()=>{
 const router=fs.readFileSync(new URL('../../apps/api/src/modules/tasks/core-router.js',import.meta.url),'utf8');
 for(const name of ['recordDetails','recordComments','recordActivity','recordChildren'])assert.ok(router.includes(name));
 assert.ok(router.includes('r.get("/tasks/:id/activity"'));assert.ok(router.includes('r.get("/tasks/:id/children"'));
 assert.ok(router.includes('r.post("/tasks/:id/comments"'));assert.ok(router.includes('service.checklist'));
 for(const mutation of ['.create(','.update(','.delete(','.upsert(','$executeRaw'])assert.ok(!source.includes(mutation));
});
