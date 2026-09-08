/** Local delivery smoke test; it does not start a browser or claim WebGPU rendering. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.TEST_PORT||18084);
const child=spawn(process.execPath,['tools/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port),OPEN:'0'},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
const results=[];
try{
 for(let i=0;i<100&&!stdout.includes('Keep this terminal open');i++){if(child.exitCode!==null)throw new Error(stderr||'Server exited.');await new Promise(r=>setTimeout(r,25));}
 assert(stdout.includes('XENOFIELD 4.4b'),'Release server must announce its actual version.');
 for(const name of ['index.html','styles.css','src/main.js','src/render/kinetic/compositor.js','src/render/kinetic/xenovolume.js','src/render/kinetic/projection-cache.js','assets/D20-showcase.stl','assets/calibration-panorama.exr','Xenofield-standalone.html']){
  const response=await fetch(`http://127.0.0.1:${port}/${name}`),bytes=new Uint8Array(await response.arrayBuffer()),disk=await fs.readFile(path.join(root,name));assert.equal(response.status,200);assert.deepEqual(Buffer.from(bytes),disk);results.push({path:name,status:response.status,bytes:bytes.length,type:response.headers.get('content-type')});
 }
 const missing=await fetch(`http://127.0.0.1:${port}/not-a-file`);assert.equal(missing.status,404);results.push({path:'not-a-file',status:404});
 const write=await fetch(`http://127.0.0.1:${port}/`,{method:'POST',body:'test'});assert.equal(write.status,405);results.push({path:'POST /',status:405});
 console.log(JSON.stringify({passed:results.length,scope:'Local HTTP payload/content-type delivery only; no browser GPU claim',results},null,2));
}finally{child.kill();if(child.exitCode===null)await once(child,'exit');}
