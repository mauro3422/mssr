import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {TypeSafeClient,noul,choice} from '@typesafe-ai/sdk';
import {skillContextManifestSchema,selectSkillContextModules} from '../../dist/skill-context.js';
import {extractMarkdownSections} from '../../dist/skill-context-loader.js';
import {referenceCases} from './reference-cases.mjs';
const root=new URL('./',import.meta.url),repo=new URL('../../',root),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const owners=['mssr-agent-routing','shared-skill-governance','skill-routing-maintainer','skill-maintenance-loop','mssr-observability-maintenance'];
const model='jev-1.13.0',threshold=.5,repetitions=2,catalog=[],cores=[];
for(const owner of owners){const base=new URL(`skills/${owner}/`,repo),manifest=skillContextManifestSchema.parse(JSON.parse(await readFile(new URL('context-modules.json',base),'utf8'))),skill=await readFile(new URL('SKILL.md',base),'utf8');
 cores.push({owner,text:extractMarkdownSections(skill,manifest.core.sections)});
 for(const m of manifest.modules){assert(m.source.path);const text=await readFile(new URL(m.source.path,base),'utf8');catalog.push({...m,localId:m.id,id:owner+'/'+m.id,owner,text,chars:text.length,sourceHash:hash(text)});}
}
const sizes=[8,20,catalog.length];assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length);
const selectorQuestions=items=>Object.fromEntries(items.map((x,i)=>['q'+i,noul(`¿La referencia con id "${x.id}" del catálogo aporta un procedimiento directamente útil para task en esta fase? Varias pueden servir. Seleccionar para lectura, no ejecutar. No basta compartir tema general.`)]));
const readerQuestions=c=>({answer:choice('Responde question usando las referencias recibidas. Si no contienen información suficiente, elige unknown. No inventes el procedimiento.',c.criteria)});
const groups=[];
for(const c of referenceCases){const target=catalog.find(x=>x.id===c.target);assert(target);const rest=catalog.filter(x=>x!==target).sort((a,b)=>hash([c.id,a.id]).localeCompare(hash([c.id,b.id])));
 for(const size of sizes){const subset=[target,...rest.slice(0,size-1)].sort((a,b)=>hash(['position',c.id,a.id]).localeCompare(hash(['position',c.id,b.id])));
 const started=performance.now(),baseline=selectSkillContextModules({modules:subset,intent:c.intent,stage:c.stage,maxModuleChars:1000000});
 groups.push({caseId:c.id,size,catalogIds:subset.map(x=>x.id),mssrIds:baseline.selected.map(x=>x.id),mssrDecisions:baseline.decisions,mssrMs:performance.now()-started,selectorQuestions:selectorQuestions(subset),readerQuestions:readerQuestions(c)});
 }}
const manifest={version:4,createdAt:new Date().toISOString(),model,threshold,repetitions,sizes,cases:referenceCases,catalog,cores,groups,ownershipAssumption:'Cinco padres considerados aceptados para esta comparación de módulos; NO se evalúa selección de skills, host gating ni budget global. Cores comunes completos se conservan en todos los lectores.',labelSource:'Seis tareas sintéticas y una referencia primaria esperada por tarea, identificada antes de inferencia. No se etiquetan todas las referencias útiles.',baselineSource:{skillContext:hash(await readFile(new URL('dist/skill-context.js',repo),'utf8')),contextSelection:hash(await readFile(new URL('dist/context-selection.js',repo),'utf8'))},pricePerMillionInput:.042};
manifest.fingerprint=hash(manifest);
if(process.argv.includes('--dry-run')){console.log(JSON.stringify({catalog:catalog.length,chars:catalog.reduce((s,x)=>s+x.chars,0),coreChars:cores.reduce((s,x)=>s+x.text.length,0),calls:groups.length*repetitions*4,sizes,coverage:groups.map(x=>({case:x.caseId,size:x.size,mssrCount:x.mssrIds.length,targetSelected:x.mssrIds.includes(referenceCases.find(c=>c.id===x.caseId).target)}))},null,2));process.exit(0);}
const dir=new URL(`results-references/${new Date().toISOString().replace(/[:.]/g,'-')}/`,root);await mkdir(dir,{recursive:true});await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));
for(const f of ['reference-benchmark.mjs','reference-cases.mjs'])await writeFile(new URL(f,dir),await readFile(new URL(f,root)));
for(const f of ['skill-context.js','context-selection.js'])await writeFile(new URL(f,dir),await readFile(new URL('dist/'+f,repo)));
if(process.argv.includes('--prepare')){await writeFile(new URL('results-references/prepared.json',root),JSON.stringify({directory:dir.href,manifest},null,2));console.log(JSON.stringify({prepared:true,directory:dir.href,networkCalls:0,catalogCount:catalog.length,coreChars:cores.reduce((s,x)=>s+x.text.length,0)}));process.exit(0);}
assert(process.env.TYPESAFE_API_KEY,'Usar wrapper con Credential Manager');
const client=new TypeSafeClient({timeout:30000,retry:{maxRetries:0},logLevel:'off'}),records=[];
async function call(c,g,rep,arm,state,questions){const request={model,state,questions},r={caseId:c.id,size:g.size,repetition:rep,arm,request,requestFingerprint:hash(request)},start=performance.now();
 try{r.response=await client.systemOne(request);try{assert(r.response.usage);for(const [id,q]of Object.entries(questions)){const a=r.response.answers[id];assert(a);if(q.type==='noul')assert(Number.isFinite(a.noul)&&a.noul>=0&&a.noul<=1&&!('confidence'in a));else{assert(Object.keys(q.criteria).includes(a.choice));assert(Number.isFinite(a.confidence)&&a.confidence>=0&&a.confidence<=1);assert.deepEqual(Object.keys(a.probabilities).sort(),Object.keys(q.criteria).sort());const p=Object.values(a.probabilities);assert(p.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert(Math.abs(p.reduce((s,x)=>s+x,0)-1)<=.04);}}}catch{r.error={category:'response_schema_failure'};}}
 catch(e){r.error={category:e.name?.includes('Timeout')?'timeout':e.status?'api_service_failure':'transport_or_code_failure',name:e.name,status:e.status??null};}
 r.elapsedMs=performance.now()-start;records.push(r);await appendFile(new URL('records.jsonl',dir),JSON.stringify(r)+'\n');return r;
}
for(let rep=1;rep<=repetitions;rep++)for(let i=0;i<groups.length;i++){
 const g=groups[(i+(rep-1)*7)%groups.length],c=referenceCases.find(c=>c.id===g.caseId),items=g.catalogIds.map(id=>catalog.find(x=>x.id===id));
 const select=await call(c,g,rep,'selector',{task:c.task,stage:c.stage,catalog:items.map(({id,owner,description,stages})=>({id,owner,description,stages}))},g.selectorQuestions);
 const selected=items.filter((x,j)=>(!x.stages.length||x.stages.includes(c.stage))&&(select.error||x.required||select.response.answers['q'+j].noul>=threshold));
 const sets={full:items,jev:selected,mssr:items.filter(x=>g.mssrIds.includes(x.id))};
 const arms=['full','jev','mssr'];for(let k=0;k<3;k++){const arm=arms[(k+i+rep)%3];await call(c,g,rep,arm,{task:c.task,question:c.question,cores,references:sets[arm].map(({id,text})=>({id,text}))},g.readerQuestions);}
 console.log(`${records.length}/${groups.length*repetitions*4} ${c.id} size=${g.size}: Jev ${selected.length}, MSSR ${sets.mssr.length}, primary=${selected.some(x=>x.id===c.target)}`);
}
await writeFile(new URL('results-references/latest.json',root),JSON.stringify({directory:dir.href,manifest,records},null,2));console.log('Saved '+dir.pathname);
