import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSTL,parseOBJ,parseGLB,conditionMesh,makeD20Mesh,makeProjectionShowcaseMesh,MESH_FILE_TYPES} from '../src/mesh/mesh-tools.js';

test('mesh import formats include STL OBJ PLY GLB GLTF',()=>{for(const ext of ['.stl','.obj','.ply','.glb','.gltf'])assert.ok(MESH_FILE_TYPES.includes(ext));});
test('ASCII STL and OBJ produce triangle geometry',()=>{
 const stl=new TextEncoder().encode('solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid');
 assert.equal(parseSTL(stl).indices.length,3);
 const obj=parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3');assert.equal(obj.indices.length,3);assert.equal(obj.uvs.length,3);
});
test('minimal GLB 2.0 parses embedded indexed triangle',()=>{
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0]),indices=new Uint16Array([0,1,2]);const bin=new Uint8Array(positions.byteLength+indices.byteLength+2);bin.set(new Uint8Array(positions.buffer),0);bin.set(new Uint8Array(indices.buffer),positions.byteLength);
 const gltf={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5123,count:3,type:'SCALAR'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}]};
 let json=new TextEncoder().encode(JSON.stringify(gltf));const jp=(json.length+3)&~3,bp=(bin.length+3)&~3,total=12+8+jp+8+bp,out=new Uint8Array(total),dv=new DataView(out.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,jp,true);dv.setUint32(16,0x4E4F534A,true);out.set(json,20);out.fill(0x20,20+json.length,20+jp);const bo=20+jp;dv.setUint32(bo,bp,true);dv.setUint32(bo+4,0x004E4942,true);out.set(bin,bo+8);
 const mesh=parseGLB(out);assert.equal(mesh.positions.length,3);assert.deepEqual(mesh.indices,[0,1,2]);
});
test('built-in D20 and projection knot survive conditioning and retessellation',()=>{
 for(const mesh of [makeD20Mesh(),makeProjectionShowcaseMesh()]){const packed=conditionMesh(mesh,{meshScale:100,meshWeldEpsilon:.001,meshTargetEdge:12,meshCurvatureAngle:35,meshSubdivideLevels:1,meshSmoothIterations:1,meshSmoothStrength:.12,meshSpikeThreshold:3,meshSpikeMode:'relax',meshHardEdgeAngle:55,meshTriangleCap:100000,meshRetessellate:true,meshPreserveBoundary:true,meshPreserveHardEdges:true});assert.ok(packed.vertices>0);assert.ok(packed.triangles>0);assert.equal(packed.data.length,packed.vertices*9);assert.equal(packed.indices.length,packed.triangles*3);}
});


test('packaged D20 showcase is the supplied detailed STL',()=>{
 const bytes=fs.readFileSync(new URL('../assets/D20-showcase.stl',import.meta.url));
 const mesh=parseSTL(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.equal(mesh.indices.length/3,23720);
 assert.equal(bytes.byteLength,1186084);
 const packed=conditionMesh(mesh,{meshScale:100,meshWeldEpsilon:.001,meshRetessellate:false,meshSmoothIterations:0,meshSpikeMode:'leave',meshHardEdgeAngle:28,meshPreserveBoundary:true,meshPreserveHardEdges:true});
 assert.ok(packed.vertices>30000);
 assert.equal(packed.triangles,23720);
});
