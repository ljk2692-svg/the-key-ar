#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const exists=relative=>fs.existsSync(path.join(root,relative));
const html=read("key-lens-final.html");
const registrySource=read("hint-registry.js");
const engine=read("hint-engine.js");
const css=read("hint-protocol.css");
const baseline=JSON.parse(read("qa/main-ar-baseline.json"));
const contentMaster=JSON.parse(read("qa/content-master.json"));
const manifest=JSON.parse(read("hint-nodes/manifest.json"));
const nodeMaster=read("hint-nodes/index.html");
const markerTrackingQA=read("qa/hint-marker-tracking.html");
const privateMasterPath=process.env.KEY_LENS_PRIVATE_MASTER||path.resolve(root,"../THE-KEY-CONTENT-MASTER-PRIVATE.json");
const privateMaster=fs.existsSync(privateMasterPath)?JSON.parse(fs.readFileSync(privateMasterPath,"utf8")):null;
const results=[];
let failures=0;

function check(name,condition,detail=""){
  const pass=Boolean(condition);results.push({name,pass,detail});if(!pass)failures++;
  console.log(`${pass?"PASS":"FAIL"}  ${name}${detail?` · ${detail}`:""}`);
}
function skip(name,detail="private master unavailable"){
  results.push({name,pass:true,skipped:true,detail});console.log(`SKIP  ${name} · ${detail}`);
}
function equalArrays(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index])}
function sha(value){return crypto.createHash("sha256").update(value).digest("hex")}
function functionRegion(name,nextName=null){
  const start=html.indexOf(`async function ${name}(`);
  if(start<2)return "";
  if(nextName){const end=html.indexOf(`async function ${nextName}(`,start);return end<2?"":html.slice(start-2,end-2)}
  const open=html.indexOf("{",start);let depth=0,state="code";
  for(let i=open;i<html.length;i++){
    const char=html[i],next=html[i+1];
    if(state==="line"){if(char==="\n")state="code";continue}
    if(state==="block"){if(char==="*"&&next==="/"){state="code";i++}continue}
    if(state==="single"){if(char==="\\")i++;else if(char==="'")state="code";continue}
    if(state==="double"){if(char==="\\")i++;else if(char==='"')state="code";continue}
    if(state==="template"){if(char==="\\")i++;else if(char==="`")state="code";continue}
    if(char==="/"&&next==="/"){state="line";i++;continue}
    if(char==="/"&&next==="*"){state="block";i++;continue}
    if(char==="'"){state="single";continue}if(char==='"'){state="double";continue}if(char==="`"){state="template";continue}
    if(char==="{")depth++;else if(char==="}"&&!--depth)return html.slice(start-2,i+3);
  }
  return "";
}
function allStrings(value,output=[]){
  if(typeof value==="string")output.push(value);
  else if(Array.isArray(value))value.forEach(item=>allStrings(item,output));
  else if(value&&typeof value==="object")Object.values(value).forEach(item=>allStrings(item,output));
  return output;
}

for(const [index,body] of [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).entries()){
  try{new vm.Script(body,{filename:`key-lens-final.inline-${index+1}.js`});check(`inline JavaScript ${index+1}`,true)}
  catch(error){check(`inline JavaScript ${index+1}`,false,error.message)}
}
for(const filename of ["hint-registry.js","hint-engine.js"]){
  try{new vm.Script(read(filename),{filename});check(`${filename} syntax`,true)}
  catch(error){check(`${filename} syntax`,false,error.message)}
}

const sandbox={window:{}};vm.createContext(sandbox);new vm.Script(registrySource).runInContext(sandbox);
const registry=sandbox.window.KEY_LENS_HINT_REGISTRY;
const config=sandbox.window.KEY_LENS_HINT_CONFIG;
const presets=sandbox.window.KEY_LENS_HINT_PRESETS;
const mainBindings=sandbox.window.KEY_LENS_MAIN_HINT_BINDINGS;
const registryIds=Object.keys(registry);
const rawIds=[...registrySource.matchAll(/\bid:"(H-[A-Z0-9]+)"/g)].map(match=>match[1]);
const completeNodes=Object.values(registry).filter(node=>node.enabled&&node.implementation==="COMPLETE");
const bundledCssMatch=html.match(/<style data-key-lens-hint-bundle="css">([\s\S]*?)<\/style>/);
const bundledRegistryMatch=html.match(/<script data-key-lens-hint-bundle="registry">([\s\S]*?)<\/script>/);
const bundledPatternsMatch=html.match(/<script data-key-lens-hint-bundle="patterns">([\s\S]*?)<\/script>/);
const bundledEngineMatch=html.match(/<script data-key-lens-hint-bundle="engine">([\s\S]*?)<\/script>/);
const bundleSandbox={window:{}};
if(bundledPatternsMatch){vm.createContext(bundleSandbox);new vm.Script(bundledPatternsMatch[1]).runInContext(bundleSandbox)}
const bundledPatterns=bundleSandbox.window.KEY_LENS_HINT_PATTERNS||{};

check("AR01~05 main target entities",(html.match(/<a-nft\b/g)||[]).length===5,"5/5");
check("MAIN TARGET registry",(html.match(/\{id:"0[1-5]",key:/g)||[]).length===5,"5/5");
check("MAIN target datasets",[1,2,3,4,5].every(id=>["iset","fset","fset3"].every(ext=>exists(`target-nft/key-lens-target-0${id}.${ext}`))),"15/15");

const names=["buildRotate","buildAnalyze","buildActivate","buildDecrypt","buildAssemble"];
names.forEach((name,index)=>{
  const region=functionRegion(name,index<names.length-1?names[index+1]:null);
  check(`${name} regression hash`,sha(region)===baseline.builders[name],sha(region).slice(0,12));
});

check("HINT registry ID uniqueness",rawIds.length===new Set(rawIds).size&&rawIds.length===registryIds.length,`${registryIds.length} nodes`);
check("MAIN/HINT bindings",Object.keys(mainBindings).length===5&&mainBindings["R1-Q02"]?.route==="AR01"&&mainBindings["R1-Q04"]?.route==="AR02",`${Object.keys(mainBindings).length}/5`);
check("R1-Q04 level 2 binding",mainBindings["R1-Q04"]?.level2==="황씨부터 분석");
check("HINT preset registry",Object.values(registry).every(node=>presets.includes(node.visualPreset)),`${presets.length} presets`);
check("visual preset routes",presets.every(preset=>new RegExp(`\\b${preset}:build[A-Za-z]+`).test(engine)),`${presets.length}/${presets.length}`);
check("confirmed copy slots",completeNodes.every(node=>node.copy?.SCHOOL?.level1?.line1&&node.copy?.CORPORATE?.level1?.line1),`${completeNodes.length}/${completeNodes.length}`);
check("scaffold tracking disabled",Object.values(registry).filter(node=>node.implementation==="SCAFFOLD").every(node=>node.enabled===false&&node.copy===null));
check("mounted-node budget",completeNodes.length<=config.tracking.maxMountedNodes,`${completeNodes.length}/${config.tracking.maxMountedNodes}`);
check("round tracking filter",engine.includes('roundParam==="ALL"||String(node.round)===roundParam'));
const roundCounts=Object.fromEntries([1,2,3].map(round=>[round,completeNodes.filter(node=>node.round===round).length]));
check("round group inventory",roundCounts[1]===0&&roundCounts[2]===1&&roundCounts[3]===3,`R1:${roundCounts[1]} R2:${roundCounts[2]} R3:${roundCounts[3]}`);
check("event-mode level timing",config.eventModes.FAST_120.level2DelayMs<config.eventModes.STANDARD_150.level2DelayMs&&config.eventModes.STANDARD_150.level2DelayMs<config.eventModes.STRATEGY_180.level2DelayMs);

check("NODE manifest alignment",manifest.nodeCount===registryIds.length&&equalArrays(manifest.nodes.map(node=>node.id),registryIds),`${manifest.nodeCount}/${registryIds.length}`);
check("NODE manifest active count",manifest.activeNodeCount===completeNodes.length,`${manifest.activeNodeCount}/${completeNodes.length}`);
check("NODE robust module grid",manifest.recognitionRevision==="ROBUST-V2"&&manifest.grid===16&&manifest.logicalGrid===8&&manifest.moduleScale===2);
check("NODE rotational separation",manifest.minimumRotationalHammingDistance>=.32,String(manifest.minimumRotationalHammingDistance));
for(const id of registryIds){
  check(`${id} assets`,["patt","png","svg","marker.png"].every(extension=>exists(`hint-nodes/${id}.${extension}`)));
  const values=read(`hint-nodes/${id}.patt`).trim().split(/\s+/).map(Number);
  check(`${id} pattern data`,values.length===3072&&values.every(value=>Number.isInteger(value)&&value>=0&&value<=255),`${values.length} values`);
}

check("HINT marker route",engine.includes('marker.addEventListener("markerFound"')&&engine.includes('run(node.id,"marker",1)'));
check("NODE master active/pending distinction",nodeMaster.includes(`PRODUCTION ACTIVE · <span class="count">${completeNodes.length}</span>`)&&nodeMaster.includes("TRACKING OFF")&&nodeMaster.includes("?node=H-R3M07"));
check("NODE master scan enlargement",nodeMaster.includes('body.singleMode #singleView{display:grid}')&&nodeMaster.includes('id="singleImage"'));
check("static marker tracking QA",completeNodes.every(node=>markerTrackingQA.includes(`"${node.id}"`))&&markerTrackingQA.includes("sourceType:image")&&markerTrackingQA.includes('id===sourceId?"PASS":"FAIL"'));
check("static marker QA dependencies local",markerTrackingQA.includes('../vendor/aframe-1.6.0.min.js')&&exists("vendor/aframe-1.6.0.min.js"));
check("Operator HINT route",html.includes('id="hintOperator"')&&engine.includes("data-hint-test")&&engine.includes('run(button.dataset.hintTest,"operator",1)'));
check("Diagnostic fields",["CAMERA:","TRACKER:","MAIN TARGETS:","HINT NODES:","ACTIVE GROUP:","LAST TARGET:","ROUTE:","FPS:","ACTIVE OBJECTS:","NODE LOAD ERROR:"].every(label=>engine.includes(label)));
check("HINT cleanup lifecycle",["function cancel(","function resetAll(","HintFX.dispose","rec.timers.forEach(clearTimeout)","rec.root.parent?.remove"].every(fragment=>engine.includes(fragment)));
check("RESET bridge",engine.includes('#operator-reset')&&engine.includes("resetAll({hud:false})"));
check("participant debug hidden",css.includes("#hintOperator{display:none")&&engine.includes('diagnosticMode=operatorMode||qs.get("diag")==="1"'));
check("MAIN/HINT UI distinction",html.includes("HINT NODE")&&engine.includes('pill.textContent=nextLevel===2?"HINT LEVEL 2":"HINT NODE"'));

const participantSource=[html,registrySource,engine].join("\n");
check("QA master not loaded by participant",!participantSource.includes("content-master.json"));
const pinTokens=privateMaster?privateMaster.missions.flatMap(item=>item.canonicalAnswer.match(/\b\d{4,}\b/g)||[]):[];
if(privateMaster)check("canonical passwords not exposed",pinTokens.length>=3&&!pinTokens.some(secret=>participantSource.includes(secret)),`${pinTokens.length} private tokens checked`);
else skip("canonical passwords not exposed");
const m07Copy=allStrings(registry["H-R3M07"].copy).join(" ");
const m07Forbidden=privateMaster?.missions.find(item=>item.missionId==="R3-M07")?.forbiddenHintCopy||[];
if(privateMaster)check("M07 direct answer blocked",m07Forbidden.length>0&&!m07Forbidden.some(value=>m07Copy.toUpperCase().includes(value.toUpperCase())));
else skip("M07 direct answer blocked");
const m08Copy=allStrings(registry["H-R3M08"].copy).join(" ");
const m08Forbidden=privateMaster?.missions.find(item=>item.missionId==="R3-M08")?.forbiddenHintCopy||[];
if(privateMaster)check("M08 direct instruction blocked",m08Forbidden.length>0&&!m08Forbidden.some(value=>m08Copy.includes(value)));
else skip("M08 direct instruction blocked");
check("Content Master correction flag",contentMaster.missions.find(item=>item.missionId==="R1-Q02")?.qa==="KNOWN_CORRECTION");
if(privateMaster){
  check("private Content Master available",privateMaster.classification==="CONFIDENTIAL_OPERATIONS");
  check("Content Master ID alignment",equalArrays(contentMaster.missions.map(item=>item.missionId),privateMaster.missions.map(item=>item.missionId)));
}else{
  skip("private Content Master available");skip("Content Master ID alignment");
}
check("Content Master participant isolation",contentMaster.missions.every(item=>item.arDirectAnswerExposure===false&&item.canonicalAnswerPresentInRepository===false&&!Object.hasOwn(item,"canonicalAnswer")));

check("V24.2 build label",html.includes('FINAL-PRODUCTION-V24.2-HINT-NODE-ROBUST-V2')&&config.version==="24.2.0");
check("standalone HINT CSS",html.includes('data-key-lens-hint-bundle="css"')&&!html.includes('href="./hint-protocol.css"'));
const registryBundleIndex=html.indexOf('data-key-lens-hint-bundle="registry"'),patternsBundleIndex=html.indexOf('data-key-lens-hint-bundle="patterns"'),engineBundleIndex=html.indexOf('data-key-lens-hint-bundle="engine"');
check("standalone HINT script order",registryBundleIndex>0&&registryBundleIndex<patternsBundleIndex&&patternsBundleIndex<engineBundleIndex&&!html.includes('src="./hint-engine.js"'));
check("standalone source parity",bundledCssMatch?.[1].trim()===css.trim()&&bundledRegistryMatch?.[1].trim()===registrySource.trim()&&bundledEngineMatch?.[1].trim()===engine.trim());
check("embedded HINT patterns",completeNodes.every(node=>bundledPatterns[node.id]===read(`hint-nodes/${node.id}.patt`)),`${Object.keys(bundledPatterns).length}/${completeNodes.length}`);
check("camera initialization preserved",html.includes('window.addEventListener("camera-init"')&&html.includes("function applyCameraFit()")&&html.includes("samsungPortraitRect"));
check("AR.js initialization preserved",html.includes('trackingMethod:best;sourceType:webcam')&&html.includes('vendor/aframe-ar-nft-3.4.8-keylens.js'));

console.log(`\n${failures?"VERIFY FAILED":"VERIFY PASS"}: ${results.length-failures}/${results.length} checks passed`);
process.exitCode=failures?1:0;
