import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';
import { realSectionSplitCases } from './real-section-split-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MODEL = 'jev-1.13.0';
const VARIANTS = ['text','parent','neighborhood','contract'];
const REPS = 3;
const CONCURRENCY = 6;
const HIGH = 0.82;
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const dry = process.argv.includes('--dry-run');

const actionCriteria = {
  keep_baseline: 'La sección contiene verdad current/broad del parent, una restricción/invariante vigente o una parte necesaria del contrato actual; debe permanecer en el baseline compacto.',
  move_reference: 'La sección es detalle histórico/profundo subordinado que sigue siendo útil, pero puede moverse VERBATIM detrás de una referencia selectiva sin cambiar la autoridad lógica del parent ni perder verdad current.',
  review: 'La evidencia no alcanza para garantizar keep o move de forma automática; hay mezcla de current/history, dependencia contextual o ambigüedad que requiere revisión.',
};
const lifecycleCriteria = {
  current: 'La sección expresa una regla/estado/contrato vigente del parent.',
  historical: 'La sección documenta evolución pasada, versiones previas o evidencia histórica útil pero no necesaria como verdad current del baseline.',
  mixed: 'Contiene material current e histórico inseparable con seguridad.',
  unknown: 'La vigencia no puede determinarse con la evidencia entregada.',
};
const relationToParentCriteria = {
  core_truth: 'Parte central del significado/contrato vigente del parent.',
  historical_support: 'Historia/evidencia que explica al parent pero puede recuperarse selectivamente.',
  deep_support: 'Detalle vigente útil pero demasiado específico para baseline universal.',
  unrelated: 'No pertenece realmente al parent.',
  unknown: 'Relación insuficientemente demostrada.',
};
const splitContract = {
  goal: 'Compaction is structural, not generative. Preserve exact bytes. Keep current/broad truth in baseline; move only clearly subordinate historical/deep detail to a selective physical ref. Never invent boundaries or rewrite canonical text.',
  safety: [
    'A move must be safe even if the ref is not loaded on unrelated tasks.',
    'Importance does not force baseline residency; current/broad applicability does.',
    'Historical evidence may be preserved behind a ref; preserving bytes is different from pinning them in baseline.',
    'Unknown/conflicting temporal validity => review, not move.',
    'A heading containing an old version is evidence, not sufficient by itself: use section meaning and parent purpose.',
  ],
};

function headings(markdown) { return markdown.split(/\r?\n/).filter((line) => /^##\s/.test(line)); }
function extract(markdown, heading) {
  const lines=markdown.split(/\r?\n/), start=lines.findIndex((l)=>l.trim()===heading.trim());
  if(start<0) throw new Error(`missing heading ${heading}`);
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){if(/^#{1,2}\s/.test(lines[i])){end=i;break;}}
  return lines.slice(start,end).join('\n').trim();
}
function selectors(entry){const keys=['domains','actions','artifacts','needs','signals','stages'];return Object.fromEntries(keys.flatMap(k=>entry[k]?.length?[[k,entry[k]]]:[]));}

const manifest=JSON.parse(await readFile(path.join(ROOT,'.mssr','project-context.json'),'utf8'));
const entries=new Map([...manifest.core,...manifest.modules].map(x=>[x.id,x]));
const cases=[];
for(const group of realSectionSplitCases){
  const entry=entries.get(group.moduleId); assert(entry,`missing ${group.moduleId}`);
  const markdown=await readFile(path.join(ROOT,entry.source.path),'utf8');
  const siblingHeadings=headings(markdown);
  for(const [heading,expectedAction] of Object.entries(group.sections)){
    const index=siblingHeadings.indexOf(heading); assert(index>=0,`heading absent ${heading}`);
    cases.push({
      id:`${group.moduleId}:${heading}`,
      moduleId:group.moduleId, entry, heading, text:extract(markdown,heading), expectedAction,
      siblingHeadings,index,
      expectedLifecycle: expectedAction==='move_reference'?'historical':'current',
    });
  }
}

function stateFor(c,variant){
  const section={heading:c.heading,text:c.text};
  const state={goal:'Decide safe exact-section compaction inside one already-authoritative MSSR parent. Classify the SECTION, not the importance of the whole project.',section};
  if(variant!=='text') state.parent={
    moduleId:c.entry.id,
    logicalKind:c.entry.kind,
    topic:c.entry.topic??null,
    area:c.entry.area??null,
    description:c.entry.description,
    sourceRef:c.entry.source.path,
    selectors:selectors(c.entry),
    maxChars:c.entry.maxChars??null,
  };
  if(variant==='neighborhood'||variant==='contract') state.neighborhood={
    sectionIndex:c.index,
    sectionCount:c.siblingHeadings.length,
    previousHeading:c.index>0?c.siblingHeadings[c.index-1]:null,
    nextHeading:c.index+1<c.siblingHeadings.length?c.siblingHeadings[c.index+1]:null,
    siblingHeadings:c.siblingHeadings,
  };
  if(variant==='contract') state.splitContract=splitContract;
  return state;
}
function questions(){return {
  action:choice('Choose the safe compaction action for section inside parent. move_reference means exact-byte externalization behind the SAME logical parent, not deletion/reclassification.',actionCriteria),
  lifecycle:choice('Classify temporal validity of section relative to the current parent contract.',lifecycleCriteria),
  parentRelation:choice('How does section relate to the parent logical authority?',relationToParentCriteria),
  baselineNeed:noul('Probability that unrelated future tasks would lose necessary CURRENT/BROAD parent truth if this section were absent from baseline and only available through a selective ref.'),
  referenceValue:noul('Probability that the section remains useful enough to preserve verbatim behind a selective ref if it is not needed in baseline.'),
};}
function validate(res,q){for(const [id,qq] of Object.entries(q)){const a=res.answers?.[id];assert(a,`missing ${id}`);if(qq.type==='noul')assert(Number.isFinite(a.noul)&&a.noul>=0&&a.noul<=1);else{assert(a.choice in qq.criteria);assert(Number.isFinite(a.confidence)&&a.confidence>=0&&a.confidence<=1);}}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function w(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},w));return out;}
const prepared=[];
for(let rep=1;rep<=REPS;rep++)for(const c of cases)for(const variant of VARIANTS){const q=questions(),state=stateFor(c,variant);prepared.push({rep,c,variant,q,state});}
const experimentManifest={
  schemaVersion:1,experiment:'mssr-real-section-safe-split-v1',model:MODEL,repetitions:REPS,variants:VARIANTS,
  caseCount:cases.length,requestCount:prepared.length,casesFingerprint:hash(realSectionSplitCases),highConfidenceThreshold:HIGH,
  labelPolicy:'Actions frozen manually from current MSSR authority semantics before inference: current contract/boundary sections stay baseline; clearly versioned history inside dedicated history modules moves verbatim; no expected labels enter state.',
  statePolicy:'One section per independent Jev state. Parent and sibling metadata are compact; sibling text is not included. No unrelated document corpus is injected.',
};
if(dry){console.log(JSON.stringify(experimentManifest,null,2));process.exit(0);}
if(!process.env.TYPESAFE_API_KEY)throw new Error('Use real-section-split-benchmark.ps1');
const client=new TypeSafeClient({timeout:30000,retry:{maxRetries:0},logLevel:'off'});
const runId=new Date().toISOString().replace(/[:.]/g,'-'),outDir=path.join(HERE,'results-real-section-split',runId);await mkdir(outDir,{recursive:true});await writeFile(path.join(outDir,'manifest.json'),JSON.stringify(experimentManifest,null,2));
const records=await mapLimit(prepared,CONCURRENCY,async(p,index)=>{const started=performance.now();const res=await client.systemOne({model:MODEL,state:p.state,questions:p.q});validate(res,p.q);return{index,rep:p.rep,variant:p.variant,id:p.c.id,moduleId:p.c.moduleId,heading:p.c.heading,expectedAction:p.c.expectedAction,expectedLifecycle:p.c.expectedLifecycle,stateChars:JSON.stringify(p.state).length,requestFingerprint:hash({state:p.state,questions:p.q}),elapsedMs:performance.now()-started,usage:res.usage,answers:res.answers};});
function score(rr){let correct=0,tp=0,fp=0,fn=0,tn=0,review=0,highFalseMove=0,lifecycleCorrect=0;const falseMoves=[],missedMoves=[];let brierBaseline=0,brierRef=0;
  for(const r of rr){const pred=r.answers.action.choice,truth=r.expectedAction;if(pred===truth)correct++;if(pred==='review')review++;const pm=pred==='move_reference',tm=truth==='move_reference';if(pm&&tm)tp++;else if(pm&&!tm){fp++;falseMoves.push({id:r.id,confidence:r.answers.action.confidence,pred,truth});if(r.answers.action.confidence>=HIGH)highFalseMove++;}else if(!pm&&tm){fn++;missedMoves.push({id:r.id,pred,confidence:r.answers.action.confidence});}else tn++;if(r.answers.lifecycle.choice===r.expectedLifecycle)lifecycleCorrect++;const baselineTruth=truth==='keep_baseline'?1:0,refTruth=truth==='move_reference'?1:0;brierBaseline+=(r.answers.baselineNeed.noul-baselineTruth)**2;brierRef+=(r.answers.referenceValue.noul-refTruth)**2;}
  return{correct,total:rr.length,accuracy:correct/rr.length,autoMove:{tp,fp,fn,tn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,dangerousFalseMoves:fp,highConfidenceFalseMoves:highFalseMove,falseMoves,missedMoves},reviewRate:review/rr.length,lifecycleAccuracy:lifecycleCorrect/rr.length,brierBaseline:brierBaseline/rr.length,brierReferenceValue:brierRef/rr.length};}
const summary={runId,model:MODEL,cases:cases.length,repetitions:REPS,variants:{}};
for(const variant of VARIANTS){const rr=records.filter(r=>r.variant===variant);const perRep=[];for(let rep=1;rep<=REPS;rep++)perRep.push({rep,...score(rr.filter(r=>r.rep===rep))});summary.variants[variant]={aggregate:score(rr),perRep,inputTokens:rr.reduce((s,r)=>s+(r.usage?.input_tokens??0),0),outputTokens:rr.reduce((s,r)=>s+(r.usage?.output_tokens??0),0)};}
await writeFile(path.join(outDir,'records.json'),JSON.stringify(records,null,2));await writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2));await writeFile(path.join(HERE,'results-real-section-split','latest.json'),JSON.stringify({manifest:experimentManifest,summary},null,2));console.log(JSON.stringify(summary,null,2));
