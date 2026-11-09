'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const root=resolve(__dirname,'..'),ts=require(join(root,'functions/node_modules/typescript'));
assert.equal(ts.version,'5.9.3');
for(const stem of ['index','cors']){
 const source=readFileSync(join(root,'functions/src',stem+'.ts'),'utf8');
 const expected=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,sourceMap:false}}).outputText;
 assert.equal(readFileSync(join(root,'functions/lib/functions/src',stem+'.js'),'utf8'),expected,'Deployment runtime drift: '+stem+'; regenerate from canonical TypeScript before commit');
}
console.log('Deployment entry/CORS runtime match canonical TypeScript with pinned compiler.');
