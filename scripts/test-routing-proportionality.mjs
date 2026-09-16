import assert from 'node:assert/strict';
import { CapabilityRegistry, FilesystemSkillProvider, planSkillRoute, resolveSkillLoadSelection } from '../dist/index.js';
const registry = new CapabilityRegistry([new FilesystemSkillProvider()]);
const snapshot = await registry.refresh();
const skills = snapshot.capabilities.flatMap(c => c.kind === 'skill' && c.skill ? [c.skill] : []);
const cases = [
  { name:'factual', actions:['discover'], needs:[], risk:'read-only', signals:['nominal'], absent:['persistence','maintenance'] },
  { name:'resume', actions:['discover','review','analyze','verify'], needs:['history-recovery','integrity-verification'], risk:'read-only', signals:['nominal'], absent:['persistence','maintenance'] },
  { name:'git-status', actions:['review','verify'], needs:['version-control'], risk:'read-only', signals:['nominal'], absent:['persistence','maintenance'] },
  { name:'edit', actions:['edit','verify'], needs:['integrity-verification'], risk:'write', signals:['nominal'], present:['persistence'] },
  { name:'verify', actions:['verify'], needs:['integrity-verification'], risk:'read-only', signals:['nominal'], absent:['persistence','maintenance'] },
  { name:'release', actions:['version','publish'], needs:['version-control'], risk:'external-side-effect', signals:['nominal'], present:['persistence'], publication:true },
  { name:'debug', actions:['debug'], needs:['history-recovery'], risk:'read-only', signals:['repeated-friction'], present:['maintenance'], absent:['persistence'] },
];
const results=[];
for (const c of cases) {
  const route=await planSkillRoute({task:c.name, skills, caller:'codex-local',stage:'close',maxSkills:3,
    intent:{domains:['git','coding'],actions:c.actions,artifacts:['repository'],needs:c.needs,risk:c.risk,signals:c.signals,ambiguity:'low'}});
  const phases=route.coverage.requiredPhases;
  const eligible=resolveSkillLoadSelection(route,'host-gated',[]).eligibleLoadOrder;
  results.push({name:c.name,phases,eligible,routeChars:JSON.stringify(route).length});
  if(process.argv.includes('--measure')) continue;
  for(const phase of c.absent??[]) assert.ok(!phases.includes(phase),`${c.name}: unexpected ${phase}`);
  for(const phase of c.present??[]) assert.ok(phases.includes(phase),`${c.name}: missing ${phase}`);
  if(c.publication) assert.ok(eligible.includes('git-change-publication'));
  else if(c.risk==='read-only') assert.ok(!eligible.includes('git-change-publication'),`${c.name}: publication obligation`);
}
console.log(JSON.stringify(results,null,2));
