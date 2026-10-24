// Isolated React-hook/JSX harness. This is NOT a browser or a HeroUI implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export const sourceDir=fileURLToPath(new URL('../../apps/web/src/features/workspace/',import.meta.url));
export function nodes(tree,predicate=()=>true){const out=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(!v||typeof v!=='object'||!('type'in v))return;if(predicate(v))out.push(v);walk(v.props?.children);}walk(tree);return out;}
export function first(tree,predicate){const found=nodes(tree,predicate)[0];assert.ok(found,'Expected JSX element');return found;}
export function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(tree==null||typeof tree==='boolean')return '';if(typeof tree==='object')return text(tree.props?.children);return String(tree);}
export function fixture(data,extra={}){return {data,loading:false,busy:false,error:'',notice:'',refresh(){},async act(fn){await fn();},...extra};}
export function harness({fixtures={},effects=true,overrides={}}={}){
 let active,sequence=0,timerId=0;const timers=new Map(),listeners=new Map(),cache=new Map(),moduleFixtures=new Map(Object.entries(fixtures)),routes=[];
 const env={setTimeout(fn){const key=++timerId;timers.set(key,fn);return key;},clearTimeout(key){timers.delete(key);}};
 const doc={addEventListener(n,fn){listeners.set(n,fn);},removeEventListener(n,fn){if(listeners.get(n)===fn)listeners.delete(n);},getElementById(){return {scrollIntoView(){}};}};
 const react={
  useState(initial){assert.ok(active);const owner=active,index=owner.cursor++;if(!(index in owner.slots))owner.slots[index]=typeof initial==='function'?initial():initial;return [owner.slots[index],next=>{const value=typeof next==='function'?next(owner.slots[index]):next;if(!Object.is(owner.slots[index],value)){owner.slots[index]=value;owner.dirty=true;}}];},
  useRef(initial){return react.useState(()=>({current:initial}))[0];},
  useId(){return react.useState(()=>'test-'+(++sequence))[0];},
  useMemo(fn,deps){const slot=react.useRef();if(!slot.current||deps.some((v,i)=>!Object.is(v,slot.current.deps[i])))slot.current={value:fn(),deps};return slot.current.value;},
  useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const owner=active,index=owner.cursor++;const prev=owner.effectSlots[index];if(effects&&(!prev||!deps||deps.some((v,i)=>!Object.is(v,prev.deps?.[i])))){owner.pending.push({index,fn,deps});}},
 };
 function primitive(n){const fn=props=>({type:n,props});Object.defineProperty(fn,'name',{value:n});return fn;}
 const compNames=['Modal','Card','Table','Select','ListBox','Alert'];
 const hero={};for(const n of ['Button','Form','Description','Input','Label','Text','TextArea','TextField','FieldError','Spinner','Chip'])hero[n]=n;
 for(const n of compNames){hero[n]=Object.fromEntries(['Backdrop','Container','Dialog','Header','Heading','Icon','Body','Footer','CloseTrigger','Title','Description','Content','ScrollContainer','Column','Row','Cell','Trigger','Value','Indicator','Popover','Item','ItemIndicator','Indicator'].map(key=>[key,n+'.'+key]));}
 const make=(type,props,key)=>({type,props:props||{},key});
 function requireMock(name){
  if(name in overrides)return overrides[name];
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx:make,jsxs:make,Fragment:'Fragment'};
  if(name==='@heroui/react')return hero;
  if(name==='lucide-react')return new Proxy({},{get:(_t,key)=>String(key)});
  if(name.endsWith('.css'))return {};
  if(name==='@/components/ui/input')return {Input:'Input'};
  if(name==='./dates')return {workspaceToday:()=> '2026-10-24',displayDate:value=>String(value)};
  if(name==='./jalali-timeline')return {jalaliDate:value=>String(value)};
  if(name==='./jalali-date-field')return {__esModule:true,default:'JalaliDateField'};
  if(name==='./use-module')return {emptyPage:()=>({items:[],total:0,page:1,pageSize:25}),useModule(_api,route,initial){routes.push(route);if(!moduleFixtures.has(route))moduleFixtures.set(route,fixture(initial));return moduleFixtures.get(route);}};
  if(name.startsWith('./')){for(const ext of ['.tsx','.ts','.js'])if(fs.existsSync(path.join(sourceDir,name+ext)))return load(name.slice(2)+ext);}
  throw new Error('Unmocked import: '+name);
 }
 function load(name){if(cache.has(name))return cache.get(name).exports;const code=fs.readFileSync(path.join(sourceDir,name),'utf8');const out=ts.transpileModule(code,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});const mod={exports:{}};cache.set(name,mod);vm.runInNewContext(out.outputText,{module:mod,exports:mod.exports,require:requireMock,console,Error,URL,URLSearchParams,AbortController,Blob,TextEncoder,Intl,Node:class {},document:doc,window:{...env,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})},...env,crypto:{randomUUID:()=> 'test-idempotency-key'}},{filename:name});return mod.exports;}
 function renderer(Component,initialProps){const owner={slots:[],effectSlots:[],cursor:0,pending:[],dirty:false};let props=initialProps,tree;const inputNode={validity:'',setCustomValidity(v){this.validity=v;},focus(){},matches(){return false;}};
  const render=(nextProps=props)=>{props=nextProps;let turns=0;do{assert.ok(turns++<30,'Hook render loop');owner.cursor=0;owner.dirty=false;owner.pending=[];const prev=active;active=owner;try{tree=Component(props);}finally{active=prev;}
   for(const n of nodes(tree,n=>!!n.props.ref&&typeof n.props.ref==='object')){if(n.type==='input')n.props.ref.current=inputNode;else n.props.ref.current={contains:()=>true};}
   for(const {index,fn,deps}of owner.pending){owner.effectSlots[index]?.cleanup?.();owner.effectSlots[index]={deps,cleanup:fn()};}
  }while(owner.dirty);return tree;};
  return {render,inputNode,unmount(){for(const e of Object.values(owner.effectSlots))e.cleanup?.();}};
 }
 async function flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}for(let i=0;i<8;i++)await Promise.resolve();}
 return {load,renderer,flush,timers,listeners,routes,fixtures:moduleFixtures};
}
