import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import fs from 'node:fs';
import {DEFAULTS} from '../src/core/parameters.js';import {defaultPalettes} from '../src/core/lut.js';import {EnvironmentBridge} from '../src/environment/bridge.js';
test('actual worker module generates, transfers and resumes HDR frames',async()=>{
 const url=new URL('../src/environment/worker.js',import.meta.url).href;
 const code=`import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:(m,t)=>parentPort.postMessage(m,t)}; await import(${JSON.stringify(url)}); parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(code)),{type:'module'});
 const request=m=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(m);});
 try{const m={id:1,type:'frame',settings:{...DEFAULTS},palette:defaultPalettes()[0],revision:1,dt:1/24};const a=await request(m);assert.ok(!a.error,a.error);assert.equal(a.levels[0].width,96);assert.equal(a.preview.length,a.previewWidth*a.previewHeight*4);const b=await request({...m,id:2});assert.ok(b.metrics.patternTime>a.metrics.patternTime);const hdr=fs.readFileSync(new URL('../assets/calibration-panorama.hdr',import.meta.url));const c=await request({id:3,type:'hdr',revision:2,buffer:hdr});assert.ok(!c.error,c.error);assert.ok(c.metrics.peak>10);assert.equal(c.levels[0].width,64);}finally{await worker.terminate();}
});
test('bridge coalesces frame requests and rejects stale generations',()=>{
 const original=globalThis.Worker;let mock;
 globalThis.Worker=class{constructor(){mock=this;this.sent=[];}postMessage(m){this.sent.push(m);}terminate(){}};
 try{const images=[],bridge=new EnvironmentBridge(m=>images.push(m),()=>{}),palette=defaultPalettes()[0];bridge.tick(100,DEFAULTS,palette);bridge.tick(300,DEFAULTS,palette);assert.equal(mock.sent.length,1);assert.ok(bridge.busy);bridge.invalidate();mock.onmessage({data:{id:1,revision:0,type:'frame',levels:[],metrics:{}}});assert.equal(images.length,0);assert.equal(bridge.busy,false);bridge.tick(400,DEFAULTS,palette);assert.equal(mock.sent.length,2);assert.equal(mock.sent[1].revision,1);bridge.dispose();}finally{globalThis.Worker=original;}
});

const {XenofieldRenderer}=await import('../src/render/renderer.js');
test('environment queue coalesces to the newest frame per mixer source without frame-completion gating',()=>{
 const renderer=new XenofieldRenderer({},()=>{});
 const a={levels:[{width:96,height:48}]},b={levels:[{width:128,height:64}]},h={levels:[{width:64,height:32}]};
 renderer.queueEnvironment(a,'plasma');renderer.queueEnvironment(b,'plasma');renderer.queueEnvironment(h,'hdri');
 assert.equal(renderer.pendingEnvironment.plasma,b);assert.equal(renderer.pendingEnvironment.hdri,h);
});
test('camera right strafe follows the view right vector',()=>{
 const renderer=new XenofieldRenderer({},()=>{});renderer.camera.yaw=0;
 renderer.move(new Set(['d']),1,{sceneMode:'liquid',waves:1});
 assert.ok(renderer.camera.position[0]<0);
});
