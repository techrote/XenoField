/** Dependency-free static bundler for this repository's named ES-module imports. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function bundle(entry){const seen=new Map(),order=[];
 function visit(rel){if(seen.has(rel))return;let code=fs.readFileSync(path.join(root,rel),'utf8');seen.set(rel,true);const exports=[...code.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_]\w*)/g)].map(x=>x[1]);
  code=code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,names,target)=>{const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),target));visit(resolved);return `const {${names}}=__modules[${JSON.stringify(resolved)}];`;});
  code=code.replace(/export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)/g,'');
  code=code.replace("new URL('./worker.js',import.meta.url)","globalThis.__XENOFIELD_WORKER_URL__");
  order.push(`__modules[${JSON.stringify(rel)}]=(()=>{\n${code}\nreturn {${exports.join(',')}};\n})();`);
 }
 visit(entry);return 'const __modules={};\n'+order.join('\n');
}
const worker=bundle('src/environment/worker.js'),main=bundle('src/main.js'),d20Base64=fs.readFileSync(path.join(root,'assets/D20-showcase.stl')).toString('base64');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<link rel="stylesheet" href="styles.css">',`<style>${fs.readFileSync(path.join(root,'styles.css'),'utf8')}</style>`);
const script=`globalThis.__XENOFIELD_D20_STL_BASE64__=${JSON.stringify(d20Base64)};\nglobalThis.__XENOFIELD_WORKER_URL__=URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:'text/javascript'}));\n${main}`;
html=html.replace('<script type="module" src="src/main.js"></script>',`<script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script>`);
fs.writeFileSync(path.join(root,'Xenofield-standalone.html'),html);
console.log('Generated Xenofield-standalone.html from the same source modules.');
