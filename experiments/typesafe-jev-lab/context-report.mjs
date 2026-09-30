import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
const original=JSON.parse(await readFile(new URL('results-context/latest.json',root),'utf8'));
let diagnostic=null;try{diagnostic=JSON.parse(await readFile(new URL('results-context/scope-diagnostic.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=x=>x===null||x===undefined?'—':(x*100).toFixed(1)+'%';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const audit=[];
for(const run of [original,diagnostic].filter(Boolean)){
 const {manifest:m,records}=run;
 const hash=createHash('sha256').update(JSON.stringify({specs:m.cases,distractor:m.distractor,model:m.model,repetitions:m.repetitions,threshold:m.threshold})).digest('hex');assert.equal(hash,m.fingerprint);
 assert.equal(records.length,m.cases.length*m.repetitions*m.variants.length);
 const keys=new Set(),rawRetention=[],guardRetention=[],rawSavings=[],guardSavings=[],recencyRetention=[],recencySavings=[];
 let protectedOmittedRaw=0,protectedItems=0;
 for(const r of records){const key=[r.caseId,r.variant,r.repetition].join(':');assert(!keys.has(key));keys.add(key);
  const spec=m.cases.find(s=>s.case.id===r.caseId);assert(spec);const c=spec.case;
  const state=r.variant==='short'?c.state:{...c.state,unrelatedArchive:m.distractor};
  assert.equal(createHash('sha256').update(JSON.stringify({state,questions:spec.questions})).digest('hex'),r.requestFingerprint);
  if(r.kind!=='selection')continue;
  for(const mode of ['raw','guarded']){const selected=r[mode].selected.map(id=>c.state.items.find(x=>x.id===id));assert(selected.every(Boolean));assert.equal(selected.map(x=>x.text).join('\n\n'),r[mode].text);}
  for(const p of c.state.items.filter(x=>x.protected)){protectedItems++;if(!r.raw.selected.includes(p.id))protectedOmittedRaw++;assert(r.guarded.selected.includes(p.id));}
  if(r.error){assert.deepEqual(r.guarded.selected,c.state.items.map(x=>x.id));continue;}
  if(r.response.answers.sufficient.choice==='no')assert.deepEqual(r.guarded.selected,c.state.items.map(x=>x.id));
  if(c.family==='compactacion'){
   const total=c.state.items.map(x=>x.text).join('\n\n').length;
   for(const [mode,ret,sav]of [['raw',rawRetention,rawSavings],['guarded',guardRetention,guardSavings]]){ret.push(...c.probes.map(p=>Number(r[mode].text.includes(p))));sav.push(1-r[mode].text.length/total);}
   const last=c.state.items.slice(-2).map(x=>x.text).join('\n\n');recencyRetention.push(...c.probes.map(p=>Number(last.includes(p))));recencySavings.push(1-last.length/total);
  }
 }
 const latency=Object.fromEntries(m.variants.map(v=>{const rr=records.filter(r=>r.variant===v&&!r.error),l=rr.map(r=>r.elapsedMs).sort((a,b)=>a-b);return[v,{p50Ms:l[Math.ceil(l.length*.5)-1],p95Ms:l[Math.ceil(l.length*.95)-1],maxMs:l.at(-1),inputTokens:rr.reduce((s,r)=>s+r.response.usage.input_tokens,0)}];}));
 audit.push({experiment:m.experiment??'initial-v2',id:run.summary.id,manifestVerified:true,requests:records.length,latency,protectedItems,protectedOmittedRaw,compaction:{rawProbeRecall:mean(rawRetention),guardedProbeRecall:mean(guardRetention),rawCharsSaved:mean(rawSavings),guardedCharsSaved:mean(guardSavings),keepLastTwoProbeRecall:mean(recencyRetention),keepLastTwoCharsSaved:mean(recencySavings),keepAllProbeRecall:1,keepAllCharsSaved:0}});
}
await writeFile(new URL('results-context/audit.json',root),JSON.stringify(audit,null,2));
const rows=original.summary.groups.map(g=>`<tr><td>${escape(g.family)}</td><td>${g.variant==='short'?'Corto':'+27.071 caracteres'}</td><td>${g.success}</td><td>${pct(g.precision??g.agreement)}</td><td>${pct(g.recall??g.abstentionRecall)}</td><td>${pct(g.sufficiencyAgreement)}</td></tr>`).join('');
const compactRows=audit.map(a=>`<tr><td>${a.experiment==='initial-v2'?'Pregunta inicial':'Diagnóstico: pregunta acotada'}</td><td>${pct(a.compaction.rawCharsSaved)}</td><td>${pct(a.compaction.rawProbeRecall)}</td><td>${pct(a.compaction.guardedCharsSaved)}</td><td>${pct(a.compaction.guardedProbeRecall)}</td></tr>`).join('');
const cases=original.manifest.cases.map(({case:c})=>{
 const rr=original.records.filter(r=>r.caseId===c.id),first=rr.find(r=>r.variant==='short');
 const result=c.kind==='review'?`Respuesta: ${escape(first.response?.answers.judgment.choice??'error')}`:`Elegidos: ${escape(first.raw.selected.join(', ')||'ninguno')} · con protección: ${escape(first.guarded.selected.join(', '))}`;
 return `<details><summary>${escape(c.family+' · '+c.id)}</summary><p>${escape(c.state.goal)}</p><p>${result}</p><pre>${escape(JSON.stringify({state:c.state,expected:c.expected,records:rr},null,2))}</pre></details>`;
}).join('');
const block=`<!-- CONTEXT_V2_START --><section id="context-v2"><div class="tag">NUEVO · CONTEXTO Y MEMORIAS</div><h2>¿Qué conservar, qué revisar y cuándo abstenerse?</h2><p>24 casos sintéticos × 2 tamaños de contexto × 2 repeticiones = 96 consultas. Diagnóstico posterior de 32 consultas cambia solo la pregunta de suficiencia. Originales conservados; ninguna memoria real se borra.</p><p>Modelo ${escape(original.summary.models.join(', '))} · ${original.summary.success}/96 consultas iniciales válidas · costo estimado de ambas corridas US$ ${(original.summary.estimatedUSD+(diagnostic?.summary.estimatedUSD??0)).toFixed(5)}.</p><p>Contexto corto: p50 ${Math.round(audit[0].latency.short.p50Ms)} ms / p95 ${Math.round(audit[0].latency.short.p95Ms)} ms. Con distractores: p50 ${Math.round(audit[0].latency.distractors.p50Ms)} ms / p95 ${Math.round(audit[0].latency.distractors.p95Ms)} ms.</p><div style="overflow:auto"><table><tr><th>Familia</th><th>Variante</th><th>Llamadas</th><th>Precisión / acuerdo*</th><th>Recall / abstención*</th><th>Suficiencia</th></tr>${rows}</table></div><p class="muted">*Selección: precisión y recall por fragmento. Documentación/arquitectura: acuerdo de clase y detección de evidencia insuficiente. Cuatro casos por familia; repeticiones no independientes. Etiquetas de Codex, sin revisión humana. La pregunta inicial de suficiencia mezcla selección con completar la tarea en skills/compactación: interpretar ese indicador como diagnóstico del instrumento.</p><h3>Compactación: ahorro frente a información perdida</h3><div style="overflow:auto"><table><tr><th>Experimento</th><th>Ahorro sin guardas</th><th>Datos recuperables</th><th>Ahorro con guardas</th><th>Datos recuperables</th></tr>${compactRows}</table></div><p>El ahorro mide caracteres de los fragmentos candidatos, no tokens facturados ni ahorro de caché. Datos recuperables = presencia exacta de 12 hechos predefinidos en cuatro casos; no es éxito de un agente posterior. Las guardas conservan restricciones protegidas y todo el material si Jev dice que falta evidencia. No se eliminan las fuentes.</p><p><strong>Fallo observado:</strong> el selector sin guardas omitió «no hacer commit ni push». La guarda determinista lo conservó. Ser poco relevante para escribir código no vuelve descartable una restricción.</p><h3>Inspección por caso</h3>${cases}<h3>Implementaciones públicas revisadas</h3><p><a href="https://github.com/tamaratran/fast-jev-compaction">fast-jev-compaction</a> y <a href="https://github.com/vava-nessa/pi-jev-compaction">pi-jev-compaction</a>: selección y copia literal, no resumen generado. <a href="https://github.com/chopratejas/invalidate">invalidate</a>: revisar memorias frente a nueva evidencia. <a href="https://docs.typesafe.ai/model-jaggedness/jev-1.13">Límites oficiales</a>: contexto irrelevante, indirection e instrucciones adversarias pueden degradar las decisiones.</p></section><!-- CONTEXT_V2_END -->`;
let html=await readFile(new URL('public/index.html',root),'utf8');html=html.replace(/<!-- CONTEXT_V2_START -->[\s\S]*?<!-- CONTEXT_V2_END -->/,'');html=html.replace('<main>','<main>'+block);
await writeFile(new URL('public/index.html',root),html);
console.log(JSON.stringify(audit,null,2));
