#!/usr/bin/env node

const base=new URL(process.argv[2]||"https://ljk2692-svg.github.io/the-key-ar/");
const expectedBuild=process.argv[3]||"";
const verifySourceAssets=process.argv.includes("--source-assets");
const runtimePaths=["key-lens-final.html"];
const sourcePaths=[
  "hint-registry.js",
  "hint-engine.js",
  "hint-protocol.css",
  "hint-nodes/H-R2M02.patt",
  "hint-nodes/H-R3GUIDE.patt",
  "hint-nodes/H-R3M07.patt",
  "hint-nodes/H-R3M08.patt"
];
const mainTargetPaths=[];
for(const id of ["01","02","03","04","05"]){
  for(const extension of ["iset","fset","fset3"])mainTargetPaths.push(`target-nft/key-lens-target-${id}.${extension}`);
}

let failures=0;
for(const relative of [...runtimePaths,...(verifySourceAssets?sourcePaths:[]),...mainTargetPaths]){
  try{
    const response=await fetch(new URL(relative,base),{cache:"no-store"});
    const bytes=await response.arrayBuffer();
    const ok=response.status===200&&bytes.byteLength>0;
    console.log(`${ok?"PASS":"FAIL"}  HTTP ${response.status} · ${relative} · ${bytes.byteLength} bytes`);
    if(!ok)failures++;
    if(relative==="key-lens-final.html"&&expectedBuild){
      const source=new TextDecoder().decode(bytes),matches=source.includes(`content="${expectedBuild}"`);
      console.log(`${matches?"PASS":"FAIL"}  BUILD ${expectedBuild}`);if(!matches)failures++;
    }
  }catch(error){console.log(`FAIL  ${relative} · ${error.message}`);failures++}
}
console.log(`\n${failures?"HTTP VERIFY FAILED":"HTTP VERIFY PASS"}: ${runtimePaths.length} standalone runtime + ${verifySourceAssets?`${sourcePaths.length} source assets + `:""}${mainTargetPaths.length} MAIN target files`);
process.exitCode=failures?1:0;
