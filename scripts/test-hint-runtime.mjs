#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
let now=0,nextTimer=1,nextFrame=1;
const timers=new Map(),frames=new Map();
const setFakeTimeout=(callback,delay=0)=>{const id=nextTimer++;timers.set(id,{callback,due:now+delay});return id};
const clearFakeTimeout=id=>timers.delete(id);
function advance(ms){
  const target=now+ms;
  while(true){
    const due=[...timers.entries()].filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];
    if(!due)break;now=due[1].due;timers.delete(due[0]);due[1].callback();
  }
  now=target;
}
function flushFrames(count=1,step=16){
  for(let n=0;n<count;n++){
    now+=step;const pending=[...frames.entries()];frames.clear();pending.forEach(([,callback])=>callback(now));
  }
}

class Events{
  constructor(){this.listeners=new Map()}
  addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(callback)}
  removeEventListener(type,callback){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==callback))}
  dispatchEvent(event){event.target=this;(this.listeners.get(event.type)||[]).forEach(callback=>callback(event));return true}
}
class ClassList{
  constructor(){this.values=new Set()}
  add(...values){values.forEach(value=>this.values.add(value))}
  remove(...values){values.forEach(value=>this.values.delete(value))}
  contains(value){return this.values.has(value)}
  toggle(value,force){if(force===undefined)force=!this.values.has(value);force?this.values.add(value):this.values.delete(value);return force}
}
class Vector3{
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;return this}setScalar(v){return this.set(v,v,v)}
  clone(){return new Vector3(this.x,this.y,this.z)}copy(v){return this.set(v.x,v.y,v.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  multiplyScalar(v){this.x*=v;this.y*=v;this.z*=v;return this}normalize(){const d=Math.hypot(this.x,this.y,this.z)||1;return this.multiplyScalar(1/d)}
  lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this}
  applyMatrix4(){return this}project(){return this}unproject(){return this}
}
class Euler{constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;return this}}
class Color{constructor(value=0){this.value=value}getHex(){return this.value}setHex(value){this.value=value;return this}}
class Object3D{
  constructor(){this.children=[];this.parent=null;this.position=new Vector3();this.scale=new Vector3(1,1,1);this.rotation=new Euler();this.userData={};this.visible=true;this.matrixWorld={}}
  add(...objects){objects.forEach(object=>{object.parent=this;this.children.push(object)});return this}
  remove(object){this.children=this.children.filter(value=>value!==object);object.parent=null;return this}
  traverse(callback){callback(this);this.children.forEach(child=>child.traverse(callback))}
  updateMatrixWorld(){}
}
class Group extends Object3D{}
class Geometry{dispose(){this.disposed=true}}
class BufferGeometry extends Geometry{setAttribute(name,value){this[name]=value}}
class BoxGeometry extends Geometry{}class TorusGeometry extends Geometry{}class SphereGeometry extends Geometry{}class TetrahedronGeometry extends Geometry{}
class EdgesGeometry extends Geometry{}
class Material{constructor(options={}){Object.assign(this,options);this.color=new Color(options.color);this.opacity=options.opacity??1}dispose(){this.disposed=true}}
class MeshBasicMaterial extends Material{}class LineBasicMaterial extends Material{}class PointsMaterial extends Material{}class SpriteMaterial extends Material{}
class Mesh extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isMesh=true}}
class LineSegments extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isLine=true}}
class Points extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.isPoints=true}}
class Sprite extends Object3D{constructor(material){super();this.material=material;this.isSprite=true}}
class CanvasTexture{constructor(canvas){this.canvas=canvas}}
class Float32BufferAttribute{constructor(values,size){this.values=values;this.itemSize=size}}
class Camera extends Group{
  getWorldPosition(target){return target.set(0,0,0)}worldToLocal(value){return value}updateMatrixWorld(){}
}
const THREE={Vector3,Group,BufferGeometry,BoxGeometry,TorusGeometry,SphereGeometry,TetrahedronGeometry,EdgesGeometry,MeshBasicMaterial,LineBasicMaterial,PointsMaterial,SpriteMaterial,Mesh,LineSegments,Points,Sprite,CanvasTexture,Float32BufferAttribute,DoubleSide:2,AdditiveBlending:2,NormalBlending:1,LinearFilter:1};

class FakeElement extends Events{
  constructor(tag="div",id=""){super();this.tagName=tag.toUpperCase();this.id=id;this.style={};this.dataset={};this.attributes={};this.classList=new ClassList();this.children=[];this.object3D=new Group();this._innerHTML="";this._button=null;this.textContent=""}
  setAttribute(name,value){this.attributes[name]=String(value)}getAttribute(name){return this.attributes[name]}
  appendChild(child){this.children.push(child);child.parentElement=this;return child}
  querySelector(selector){if(selector===".hintLevelButton")return this._button;return null}
  querySelectorAll(selector){if(selector==="[data-hint-test]")return [];return []}
  set innerHTML(value){this._innerHTML=value;this._button=value.includes("hintLevelButton")?new FakeElement("button"):null}
  get innerHTML(){return this._innerHTML}
  getBoundingClientRect(){return {left:0,top:0,width:480,height:640}}
  getContext(){return {createRadialGradient:()=>({addColorStop(){}}),fillRect(){},clearRect(){},beginPath(){},roundRect(){},rect(){},fill(){},stroke(){},fillText(){},set fillStyle(_){},set strokeStyle(_){},set lineWidth(_){},set textAlign(_){},set font(_){}}}
}

const ids=["arScene","hintMarkerRoot","hintSpatialLayer","hintSpatialContent","pill","guide","mission","status","message","sub","hintOperator","hintDiag","operator-reset"];
const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement("div",id)]));
elements.arScene.camera=new Camera();elements.arScene.canvas=new FakeElement("canvas");
const document={
  baseURI:"https://example.test/key-lens-final.html",
  createElement:tag=>new FakeElement(tag),
  querySelector:selector=>selector.startsWith("#")?elements[selector.slice(1).split(" ")[0]]||null:null
};
const windowEvents=new Events();
const sandbox={
  console,THREE,document,navigator:{vibrate(){}},location:{search:""},innerWidth:480,innerHeight:640,
  performance:{now:()=>now},Blob,URL,URLSearchParams,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  setTimeout:setFakeTimeout,clearTimeout:clearFakeTimeout,
  requestAnimationFrame:callback=>{const id=nextFrame++;frames.set(id,callback);return id},cancelAnimationFrame:id=>frames.delete(id),
  fetch:async()=>({ok:true,text:async()=>Array(3072).fill("255").join(" ")}),
  addEventListener:windowEvents.addEventListener.bind(windowEvents),dispatchEvent:windowEvents.dispatchEvent.bind(windowEvents),
  current:null,spatialKey:null,cameraReady:true,scannerStarted:true,lostTimers:{},
  NFT_TARGETS:Array.from({length:5},(_,index)=>({id:index+1})),
  trackingReady:()=>true,setHud:(status,message,sub)=>{sandbox.lastHud={status,message,sub}},tone(){},hideSpatial(){},resetGroup(){},
  markerFound:key=>key,markerLost:key=>key,enterScanner(){sandbox.scannerStarted=true}
};
sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,"hint-registry.js"),"utf8"),sandbox,{filename:"hint-registry.js"});
for(const node of Object.values(sandbox.KEY_LENS_HINT_REGISTRY))sandbox.KEY_LENS_HINT_PATTERNS={...(sandbox.KEY_LENS_HINT_PATTERNS||{}),[node.id]:Array(3072).fill("255").join(" ")};
vm.runInContext(fs.readFileSync(path.join(root,"hint-engine.js"),"utf8"),sandbox,{filename:"hint-engine.js"});
await Promise.resolve();await Promise.resolve();

const api=sandbox.__KEY_LENS_HINT_PROTOCOL__;
assert.ok(api,"public HINT protocol API exists");
const activeIds=["H-R1Q01","H-R2M02","H-R3GUIDE","H-R3M01","H-R3M05","H-R3M06","H-R3M07","H-R3M08"];
const pendingIds=["H-R1Q03","H-R1Q05","H-R1Q06","H-R3M02","H-R3M03","H-R3M04"];
assert.equal(elements.hintMarkerRoot.children.length,activeIds.length,"only confirmed nodes are mounted");
assert.deepEqual(elements.hintMarkerRoot.children.map(marker=>marker.dataset.hintId),activeIds);
assert.equal(api.state.totalNodes,14);assert.equal(api.state.mountedNodes,activeIds.length);

const m07=elements.hintMarkerRoot.children.find(marker=>marker.dataset.hintId==="H-R3M07");
m07.dispatchEvent({type:"markerFound"});flushFrames(8,120);
assert.match(api.state.route,/HINT \/ R3M07/);assert.equal(api.state.level,1);assert.ok(api.state.activeObjects>=20,"premium scene has multiple 3D layers");
assert.ok(elements.hintSpatialLayer.classList.contains("active"));assert.equal(sandbox.lastHud.status,"HINT PROTOCOL");
assert.equal(api.setLevel(2,"test"),true);flushFrames(3,80);assert.equal(api.state.level,2);assert.match(api.state.route,/LEVEL 2/);
m07.dispatchEvent({type:"markerLost"});advance(899);assert.equal(api.state.level,2,"lost grace keeps the scene stable");advance(2);assert.equal(api.state.level,0);assert.equal(api.state.activeObjects,0);assert.equal(elements.arScene.camera.children.length,0,"3D root disposed after target loss");

for(let cycle=0;cycle<5;cycle++){
  m07.dispatchEvent({type:"markerFound"});flushFrames(2,100);m07.dispatchEvent({type:"markerLost"});advance(901);flushFrames();
  assert.equal(elements.arScene.camera.children.length,0,`repeat cycle ${cycle+1} leaves no 3D root`);
}

const m08=elements.hintMarkerRoot.children.find(marker=>marker.dataset.hintId==="H-R3M08");
m08.dispatchEvent({type:"markerFound"});flushFrames(6,160);assert.match(api.state.route,/R3M08/);assert.ok(api.state.activeObjects>=20);
api.resetAll();assert.equal(api.state.activeObjects,0);assert.equal(api.state.level,0);assert.equal(elements.arScene.camera.children.length,0);
const objectBudgets={};
for(const id of activeIds){
  assert.equal(api.run(id,"operator"),true);flushFrames(4,160);objectBudgets[id]=api.state.activeObjects;
  assert.ok(api.state.activeObjects>=18,`${id} renders a layered premium scene`);
  assert.ok(api.state.activeObjects<=48,`${id} stays inside the 48-object mobile budget`);
  const hasLevel2=Boolean(api.registry[id].copy?.SCHOOL?.level2);
  assert.equal(api.setLevel(2,"test"),hasLevel2,`${id} level 2 policy matches Registry`);
  api.resetAll();
}
for(const id of pendingIds)assert.equal(api.run(id,"operator"),false,`${id} scaffold cannot be routed`);
for(const id of activeIds){
  const marker=elements.hintMarkerRoot.children.find(value=>value.dataset.hintId===id);
  for(let cycle=0;cycle<3;cycle++){
    marker.dispatchEvent({type:"markerFound"});flushFrames(2,90);
    assert.match(api.state.route,new RegExp(id.replace(/^H-R/,"R")),`${id} routes to its own scene`);
    marker.dispatchEvent({type:"markerLost"});advance(901);flushFrames();
    assert.equal(elements.arScene.camera.children.length,0,`${id} cycle ${cycle+1} leaves no 3D root`);
  }
}
sandbox.current="rotate";assert.equal(api.run("H-R3M08","operator"),false,"main experience has priority");sandbox.current=null;

console.log(`PASS  confirmed markers mounted · ${activeIds.length}/14`);
console.log("PASS  H-R3M07 FOUND → route → level 2 → LOST cleanup");
console.log("PASS  H-R3M07 repeated FOUND/LOST · 5 cycles · 0 leaked roots");
console.log("PASS  H-R3M08 route and 3D object budget");
console.log(`PASS  confirmed preset object budgets · ${Object.entries(objectBudgets).map(([id,count])=>`${id}:${count}`).join(" · ")}`);
console.log(`PASS  all active routes repeated · ${activeIds.length*3} cycles · 0 leaked roots`);
console.log(`PASS  NEEDS SOURCE scaffold blocked · ${pendingIds.length}/14`);
console.log("PASS  MAIN EXPERIENCE priority preserved");
console.log("\nRUNTIME PASS: HINT lifecycle simulation completed");
