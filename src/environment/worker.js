import {EnvironmentProcessor} from './processor.js';
const processor=new EnvironmentProcessor();
self.onmessage=({data})=>{const result=processor.process(data);self.postMessage(result,result.levels?[...result.levels.map(l=>l.data.buffer),result.preview.buffer]:[]);};
