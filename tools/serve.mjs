import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.hdr':'application/octet-stream','.exr':'application/octet-stream','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
 try{
  const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
  const target=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const stat=fs.statSync(target);if(!stat.isFile())throw Error('Not a file.');
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',e=>{console.error(`Server: ${e.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${port}/`;
 console.log(`XENOFIELD 4.4b → ${url}\nKeep this terminal open. Ctrl+C stops the server.`);
 // Open only once listen() has succeeded, not before the server is reachable.
 if(process.env.OPEN==='1'){
  const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/c','start','',url]:[url];
  const child=spawn(command,args,{stdio:'ignore',detached:true});
  child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
 }
});
