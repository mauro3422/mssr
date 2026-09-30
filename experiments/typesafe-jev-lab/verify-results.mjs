import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const d=JSON.parse(await readFile(new URL('./results/latest.json',import.meta.url),'utf8'));
const seen=new Set();let tp=0,fp=0,tn=0,fn=0,needsCorrect=0;
const disagreements=[];
for(const r of d.records){
 const key=r.caseId+':'+r.repetition;assert(!seen.has(key));seen.add(key);
 if(r.error)continue;
 const c=d.manifest.cases.find(c=>c.id===r.caseId);assert(c);
 assert(Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0);
 for(const [key,q]of Object.entries(d.manifest.questions)){
  const a=r.response.answers[key];assert(a);
  if(q.type==='noul'){assert(a.noul>=0&&a.noul<=1);assert(!('confidence' in a));}
  else {assert(a.confidence>=0&&a.confidence<=1);const pp=Object.values(a.probabilities);assert(pp.every(p=>p>=0&&p<=1));assert(Math.abs(pp.reduce((a,b)=>a+b,0)-1)<.035);if(q.type==='choice')assert(Object.keys(q.criteria).includes(a.choice));else assert(a.score>=0&&a.score<=4&&a.legend);}
 }
 const a=r.response.answers;const needs=a.needs_more_context.noul>=.5;needsCorrect+=Number(needs===c.expected.needs);
 if(needs!==c.expected.needs)disagreements.push({caseId:c.id,repetition:r.repetition,dimension:'needs_more_context',probability:a.needs_more_context.noul,expected:c.expected.needs,classification:'model_or_question_or_provisional_label_disagreement'});
 d.manifest.candidates.forEach((candidate,i)=>{const p=a['relevance_'+i].noul,pred=p>=.5,truth=c.expected.relevant.includes(candidate.name);if(pred&&truth)tp++;else if(pred)fp++;else if(truth)fn++;else tn++;if(pred!==truth)disagreements.push({caseId:c.id,repetition:r.repetition,dimension:candidate.name,probability:p,expected:truth,classification:'model_or_question_or_provisional_label_disagreement'});});
}
assert.equal(d.records.length,d.manifest.cases.length*d.manifest.repetitions);
const review={run:d.summary.id,validatedResponses:d.summary.success,confusion:{tp,fp,tn,fn},precision:tp/(tp+fp)||0,recall:tp/(tp+fn)||0,needsAccuracy:needsCorrect/d.summary.success,constantNegativeAccuracy:(tn+fp)/(tp+fp+tn+fn),disagreements};
await writeFile(new URL('./results/'+d.summary.id+'/review.json',import.meta.url),JSON.stringify(review,null,2));
console.log(JSON.stringify({...review,disagreements:disagreements.filter(x=>x.repetition===1)},null,2));
