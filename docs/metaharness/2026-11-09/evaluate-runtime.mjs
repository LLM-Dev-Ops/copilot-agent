import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [base,head,tools,out]=process.argv.slice(2),hash=b=>createHash('sha256').update(b).digest('hex');
const fw=await import(pathToFileURL(tools+'/node_modules/@metaharness/flywheel/dist/index.js'));
assert.equal(JSON.parse(readFileSync(tools+'/node_modules/@metaharness/flywheel/package.json')).version,'0.1.12');
for(const path of ['functions/src/index.ts','functions/src/cors.ts','functions/src/handler.test.ts','scripts/probe-runtime.cjs','docs/metaharness/2026-11-09/contract.json'])assert.ok(readFileSync(base+'/'+path).equals(readFileSync(head+'/'+path)),'Frozen bytes changed:'+path);
const rev=root=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),parent=rev(base),candidate=rev(head);
function measure(root){const r=spawnSync(process.execPath,['scripts/probe-runtime.cjs','.'],{cwd:root,encoding:'utf8',timeout:10000});assert.ok([0,1].includes(r.status),r.stderr);return JSON.parse(r.stdout);}
const trials=[];for(let i=0;i<3;i++)for(const root of i%2?[head,base]:[base,head])trials.push({i,revision:rev(root),report:measure(root)});
const paths=['functions/lib/functions/src/index.js','functions/lib/functions/src/cors.js','functions/package.json','functions/package-lock.json','scripts/check-runtime-parity.cjs','.github/workflows/function-runtime.yml'];
const inverse=paths.map(path=>existsSync(base+'/'+path)?{path,parentBytes:readFileSync(base+'/'+path,'utf8'),sha256:hash(readFileSync(base+'/'+path))}:{path,absent:true});
const measurements=[];
const result=await fw.runFlywheelGenerations({rootPolicy:{revision:parent},proposer:async()=>({value:candidate,summary:'Deploy canonical security runtime and guard compiler parity',inverse}),evaluator:async(policy,suite)=>{const root=policy.revision===parent?base:head;assert.equal(rev(root),policy.revision);const report=measure(root),items=report[suite.id==='holdout'?'holdout':'anchors'],wins=items.map(x=>x.passed),score={primary:wins.filter(Boolean).length/wins.length,itemWins:wins,noopRate:0,costPerWin:0,regressed:true};measurements.push({revision:policy.revision,suite:suite.id,report,score});return score;},holdout:{id:'holdout',items:[0,1,2,3,4,5]},anchor:{id:'anchors',items:[0,1,2,3,4]},maxGenerations:1,signer:fw.makeSigner(),promotionRule:fw.meetsPromotionRule,dataSource:'LIVE_FUNCTIONS_FRAMEWORK_DEPLOYMENT_ENTRY'});
const fingerprint=fw.gateFingerprint(fw.meetsPromotionRule),replay=fw.verifyReplayBundle(result.replayBundle,{pinnedGateFingerprint:fingerprint});assert.equal(replay.pass,true);assert.equal(result.promotions.length,0);
writeFileSync(out,JSON.stringify({trials,measurements,result,replay,fingerprint,inverse,contract:JSON.parse(readFileSync(base+'/docs/metaharness/2026-11-09/contract.json')),boundary:'regressed=true is the explicit full-gate veto for existing type/build/audit failures and unavailable RuOS/Ruflo/offline learning, not newly observed component regression. cost/noop0 neutral/unmeasured; root-only replay is not candidate promotion proof.'},null,2));console.log(JSON.stringify({trials:trials.map(x=>({i:x.i,revision:x.revision,holdout:x.report.holdout.filter(x=>x.passed).length,anchors:x.report.anchors.filter(x=>x.passed).length})),promotions:0,replay}));
