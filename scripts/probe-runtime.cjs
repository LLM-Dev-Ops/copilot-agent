'use strict';
const {createRequire}=require('node:module');
const {resolve,join}=require('node:path');
async function probe(root){
 const local=createRequire(join(resolve(root),'functions/package.json'));
 const framework=local('@google-cloud/functions-framework'),{getTestServer}=local('@google-cloud/functions-framework/testing');
 const name='runtime-parity-'+require('node:crypto').randomUUID();framework.http(name,local('./index.js').handler);const server=getTestServer(name);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 async function check(name,method,path,headers,body,test){let result={name,passed:false};try{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});const raw=await response.text();let parsed;try{parsed=JSON.parse(raw)}catch{}result.status=response.status;result.passed=test(response,parsed,raw);}catch(error){result.error=error.message;}return result;}
 try{const holdout=[];
  holdout.push(await check('exact-trusted-origin','GET','/health',{origin:'https://console.agentics.dev'},undefined,r=>r.headers.get('access-control-allow-origin')==='https://console.agentics.dev'&&r.headers.get('vary')?.includes('Origin')));
  for(const [name,headers]of [['untrusted-origin',{origin:'https://attacker.example'}],['absent-origin',{}]])holdout.push(await check(name,'GET','/health',headers,undefined,r=>r.headers.get('access-control-allow-origin')===null));
  holdout.push(await check('api-key-preflight','OPTIONS','/v1/copilot/intent',{origin:'https://console.agentics.dev'},undefined,r=>r.status===204&&r.headers.get('access-control-allow-headers')?.toLowerCase().includes('x-anthropic-api-key')));
  holdout.push(await check('ignore-untrusted-host','GET','/health',{host:'['},undefined,(r,b)=>r.status===200&&b.execution_metadata?.service==='copilot-agents'));
  holdout.push(await check('sanitize-internal-error','POST','/v1/copilot/private-route-name',{'content-type':'application/json','x-anthropic-api-key':'synthetic-not-a-key'},{objective:'test'},(r,b,raw)=>r.status===500&&raw.includes('Internal server error')&&!raw.includes('Unknown agent')&&!raw.includes('Valid agents')));
  const anchors=[];
  anchors.push(await check('health','GET','/health',{},undefined,(r,b)=>r.status===200&&b.execution_metadata?.service==='copilot-agents'&&Array.isArray(b.layers_executed)));
  anchors.push(await check('head-health','HEAD','/health',{},undefined,(r,b,raw)=>r.status===200&&raw===''));
  anchors.push(await check('missing-api-key','POST','/v1/copilot/intent',{'content-type':'application/json'},{message:'test'},r=>r.status===400));
  anchors.push(await check('not-found','GET','/unknown',{},undefined,r=>r.status===404));
  anchors.push(await check('trace-id','GET','/health',{'x-correlation-id':'native-trace'},undefined,(r,b)=>r.status===200&&b.execution_metadata?.trace_id==='native-trace'));
  return {holdout,anchors};
 }finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
}
module.exports={probe};
if(require.main===module)probe(process.argv[2]||'.').then(r=>{console.log(JSON.stringify(r));if([...r.holdout,...r.anchors].some(x=>!x.passed))process.exitCode=1;});
